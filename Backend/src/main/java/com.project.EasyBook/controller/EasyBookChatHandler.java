package com.project.EasyBook.controller;

import com.project.EasyBook.entity.Movie;
import com.project.EasyBook.entity.Show;
import com.project.EasyBook.entity.Theater;
import com.project.EasyBook.repository.MovieRepository;
import com.project.EasyBook.repository.ShowRepository;
import com.project.EasyBook.repository.TheaterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
public class EasyBookChatHandler extends TextWebSocketHandler {
    @Value("${gemini.api.key:}")
    private String apiKey;

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private ShowRepository showRepository;

    @Autowired
    private TheaterRepository theaterRepository;

    private final String GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException{
        String userInput = message.getPayload().trim().toLowerCase();
        System.out.println("JAKSIA Chat - User Input : " + userInput);

        String response;

        if (isMovieBookingQuery(userInput)) {
            response = handleMovieBookingQuery(userInput);
        } else {
            response = callGeminiForAnswer(userInput);
        }

        session.sendMessage(new TextMessage(response));
    }

    private boolean isMovieBookingQuery(String userInput) {
        String[] movieKeywords = {"movie", "book", "ticket", "show", "theater", "theatre", "cinema", "film"};
        String[] actionKeywords = {"book", "reserve", "available", "timings", "shows", "theaters", "theatres"};

        boolean hasMovieKeyword = Arrays.stream(movieKeywords).anyMatch(userInput::contains);
        boolean hasActionKeyword = Arrays.stream(actionKeywords).anyMatch(userInput::contains);

        return hasMovieKeyword || hasActionKeyword ||
                userInput.contains("what movies") || userInput.contains("movie list") ||
                userInput.contains("show timings") || userInput.contains("theaters in") ||
                userInput.contains("theatres in") || userInput.contains("shows for") ||
                containsMovieName(userInput);
    }

    private boolean containsMovieName(String userInput) {
        List<Movie> movies = movieRepository.findAll();
        return movies.stream().anyMatch(movie ->
                userInput.toLowerCase().contains(movie.getTitle().toLowerCase()));
    }

    private String handleMovieBookingQuery(String userInput) {
        try {
            // Handle different types of movie queries
            if (userInput.contains("movie") && (userInput.contains("list") || userInput.contains("available") || userInput.contains("show me"))) {
                return getAvailableMovies();
            } else if (userInput.contains("theater") || userInput.contains("theatre") || userInput.contains("cinema")) {
                return handleTheaterQuery(userInput);
            } else if ((userInput.contains("show") && (userInput.contains("timing") || userInput.contains("time"))) ||
                    userInput.contains("shows for")) {
                return handleShowTimingQuery(userInput);
            } else if (userInput.contains("book") || userInput.contains("reserve")) {
                return handleBookingQuery(userInput);
            } else if (containsSpecificMovieQuery(userInput)) {
                return handleSpecificMovieQuery(userInput);
            } else {
                return getGeneralMovieInfo();
            }
        } catch (Exception e) {
            e.printStackTrace();
            return "Sorry, I encountered an error while processing your movie booking request. Please try again.";
        }
    }

    private boolean containsSpecificMovieQuery(String userInput) {
        List<Movie> movies = movieRepository.findAll();
        return movies.stream().anyMatch(movie ->
                userInput.toLowerCase().contains(movie.getTitle().toLowerCase()));
    }

    private String handleSpecificMovieQuery(String userInput) {
        List<Movie> movies = movieRepository.findAll();
        Movie foundMovie = movies.stream()
                .filter(movie -> userInput.toLowerCase().contains(movie.getTitle().toLowerCase()))
                .findFirst()
                .orElse(null);

        if (foundMovie == null) {
            return "Sorry, I couldn't find that movie. Ask me 'What movies are available?' to see all current movies.";
        }

        // Get shows for this movie
        List<Show> shows = showRepository.findAll().stream()
                .filter(show -> show.getMovie() != null &&
                        show.getMovie().getMovieId() == foundMovie.getMovieId())
                .collect(Collectors.toList());

        if (shows.isEmpty()) {
            return String.format("🎬 %s is available but currently has no scheduled shows. Please check back later!",
                    foundMovie.getTitle());
        }

        StringBuilder response = new StringBuilder();
        response.append("🎬 ").append(foundMovie.getTitle()).append(" Details:\n");
        if (foundMovie.getGenre() != null && !foundMovie.getGenre().trim().isEmpty()) {
            response.append("Genre: ").append(foundMovie.getGenre()).append("\n");
        }
        if (foundMovie.getLang() != null && !foundMovie.getLang().trim().isEmpty()) {
            response.append("Language: ").append(foundMovie.getLang()).append("\n");
        }
        if (foundMovie.getDuration() > 0) {
            response.append("Duration: ").append(foundMovie.getDuration()).append(" mins\n");
        }

        response.append("\n🎭 Available in theaters:\n");
        Set<String> cities = shows.stream()
                .map(show -> show.getTheater().getCity())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        for (String city : cities.stream().limit(5).collect(Collectors.toList())) {
            response.append("• ").append(city).append("\n");
        }

        response.append("\nTo see specific theaters and timings, ask: 'Show theaters for ")
                .append(foundMovie.getTitle()).append(" in [city name]'");

        return response.toString();
    }

    private String getAvailableMovies() {
        List<Movie> movies = movieRepository.findAll();
        if (movies.isEmpty()) {
            return "Sorry, no movies are currently available for booking.";
        }

        StringBuilder response = new StringBuilder("🎬 Here are the available movies:\n\n");
        for (Movie movie : movies.stream().limit(10).collect(Collectors.toList())) {
            response.append("• ").append(movie.getTitle());
            if (movie.getGenre() != null && !movie.getGenre().trim().isEmpty()) {
                response.append(" (").append(movie.getGenre()).append(")");
            }
            if (movie.getDuration() > 0) {
                response.append(" - ").append(movie.getDuration()).append(" mins");
            }
            if (movie.getLang() != null && !movie.getLang().trim().isEmpty()) {
                response.append(" [").append(movie.getLang()).append("]");
            }
            response.append("\n");
        }
        response.append("\nTo book tickets, ask me: 'Show theaters for [movie name]' or 'Show me theaters in [city name]'!");
        return response.toString();
    }

    private String handleTheaterQuery(String userInput) {
        // Extract city name if mentioned
        String cityPattern = "in ([a-zA-Z ]+)";
        Pattern pattern = Pattern.compile(cityPattern);
        Matcher matcher = pattern.matcher(userInput);

        // Extract movie name if mentioned
        List<Movie> movies = movieRepository.findAll();
        Movie specificMovie = movies.stream()
                .filter(movie -> userInput.toLowerCase().contains(movie.getTitle().toLowerCase()))
                .findFirst()
                .orElse(null);

        if (matcher.find()) {
            String city = matcher.group(1).trim();

            if (specificMovie != null) {
                // Show theaters for specific movie in specific city
                return getTheatersForMovieInCity(specificMovie, city);
            } else {
                // Show all theaters in city
                List<Theater> theaters = theaterRepository.findAll().stream()
                        .filter(t -> t.getCity() != null && t.getCity().toLowerCase().contains(city.toLowerCase()))
                        .collect(Collectors.toList());

                if (theaters.isEmpty()) {
                    return "Sorry, no theaters found in " + city + ". Please check the city name or try a different location.";
                }

                StringBuilder response = new StringBuilder("🎭 Theaters in " + city + ":\n\n");
                for (Theater theater : theaters.stream().limit(8).collect(Collectors.toList())) {
                    response.append("• ").append(theater.getName()).append("\n");
                }
                response.append("\nTo see movies and show timings for a specific theater, ask about a particular movie!");
                return response.toString();
            }
        } else if (specificMovie != null) {
            // Show all theaters playing this movie
            return getTheatersForMovie(specificMovie);
        } else {
            return "Please specify the city name. For example: 'Show me theaters in Mumbai' or 'Show theaters for [movie name] in Mumbai'";
        }
    }

    private String getTheatersForMovie(Movie movie) {
        List<Show> shows = showRepository.findAll().stream()
                .filter(show -> show.getMovie() != null &&
                        show.getMovie().getMovieId() == movie.getMovieId())
                .collect(Collectors.toList());

        if (shows.isEmpty()) {
            return "Sorry, " + movie.getTitle() + " is not currently showing in any theaters.";
        }

        StringBuilder response = new StringBuilder("🎭 " + movie.getTitle() + " is playing at:\n\n");

        Map<String, List<Show>> cityWiseShows = shows.stream()
                .collect(Collectors.groupingBy(show -> show.getTheater().getCity()));

        for (Map.Entry<String, List<Show>> entry : cityWiseShows.entrySet()) {
            response.append("📍 ").append(entry.getKey()).append(":\n");
            Set<String> theaters = entry.getValue().stream()
                    .map(show -> show.getTheater().getName())
                    .collect(Collectors.toSet());

            for (String theater : theaters.stream().limit(3).collect(Collectors.toList())) {
                response.append("  • ").append(theater).append("\n");
            }
            response.append("\n");
        }

        return response.toString();
    }

    private String getTheatersForMovieInCity(Movie movie, String city) {
        List<Show> shows = showRepository.findAll().stream()
                .filter(show -> show.getMovie() != null &&
                        show.getMovie().getMovieId() == movie.getMovieId() &&
                        show.getTheater().getCity().toLowerCase().contains(city.toLowerCase()))
                .collect(Collectors.toList());

        if (shows.isEmpty()) {
            return String.format("Sorry, %s is not currently showing in %s.", movie.getTitle(), city);
        }

        StringBuilder response = new StringBuilder();
        response.append("🎭 ").append(movie.getTitle()).append(" in ").append(city).append(":\n\n");

        Map<String, List<Show>> theaterWiseShows = shows.stream()
                .collect(Collectors.groupingBy(show -> show.getTheater().getName()));

        for (Map.Entry<String, List<Show>> entry : theaterWiseShows.entrySet()) {
            response.append("• ").append(entry.getKey()).append("\n");
            response.append("  Show times: ");
            List<String> timings = entry.getValue().stream()
                    .map(Show::getTiming)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());
            response.append(String.join(", ", timings)).append("\n");

            int totalSeats = entry.getValue().stream()
                    .mapToInt(Show::getAvailableSeats)
                    .sum();
            response.append("  Available seats: ").append(totalSeats).append("\n\n");
        }

        response.append("To book tickets, visit our booking page!");
        return response.toString();
    }

    private String handleShowTimingQuery(String userInput) {
        // Try to find movie name in the query
        List<Movie> movies = movieRepository.findAll();
        Movie specificMovie = movies.stream()
                .filter(movie -> userInput.toLowerCase().contains(movie.getTitle().toLowerCase()))
                .findFirst()
                .orElse(null);

        if (specificMovie != null) {
            List<Show> shows = showRepository.findAll().stream()
                    .filter(show -> show.getMovie() != null &&
                            show.getMovie().getMovieId() == specificMovie.getMovieId())
                    .collect(Collectors.toList());

            if (shows.isEmpty()) {
                return "Sorry, no show timings found for " + specificMovie.getTitle();
            }

            StringBuilder response = new StringBuilder("🕐 Show timings for " + specificMovie.getTitle() + ":\n\n");

            Map<String, Map<String, List<String>>> cityTheaterTimings = shows.stream()
                    .collect(Collectors.groupingBy(
                            show -> show.getTheater().getCity(),
                            Collectors.groupingBy(
                                    show -> show.getTheater().getName(),
                                    Collectors.mapping(Show::getTiming, Collectors.toList())
                            )
                    ));

            for (Map.Entry<String, Map<String, List<String>>> cityEntry : cityTheaterTimings.entrySet()) {
                response.append("📍 ").append(cityEntry.getKey()).append(":\n");
                for (Map.Entry<String, List<String>> theaterEntry : cityEntry.getValue().entrySet()) {
                    response.append("  🎭 ").append(theaterEntry.getKey()).append(": ");
                    response.append(String.join(", ", theaterEntry.getValue())).append("\n");
                }
                response.append("\n");
            }

            return response.toString();
        }

        return "🕐 To check show timings:\n\n" +
                "Ask me: 'Show timings for [movie name]'\n" +
                "Example: 'Show timings for Avatar'\n\n" +
                "Or first ask: 'What movies are available?' to see all movies!";
    }

    private String handleBookingQuery(String userInput) {
        return "🎫 To book movie tickets:\n\n" +
                "1. Browse available movies\n" +
                "2. Select your preferred city and theater\n" +
                "3. Choose show timing\n" +
                "4. Select your seats\n" +
                "5. Complete payment\n\n" +
                "Visit our booking page to start the process, or ask me 'What movies are available?' to begin!";
    }

    private String getGeneralMovieInfo() {
        long movieCount = movieRepository.count();
        long theaterCount = theaterRepository.count();

        return String.format("🎬 Welcome to EasyBook!\n\n" +
                "We have %d movies playing across %d theaters.\n\n" +
                "You can ask me:\n" +
                "• 'What movies are available?'\n" +
                "• 'Show me theaters in [city name]'\n" +
                "• 'How do I book tickets?'\n" +
                "• 'What are the show timings?'\n\n" +
                "How can I help you today?", movieCount, theaterCount);
    }

    private String callGeminiForAnswer(String userInput) {
        if (apiKey == null || apiKey.isEmpty()) {
            return "I'm here to help you with movie bookings! Ask me about available movies, theaters, or how to book tickets.";
        }

        try {
            RestTemplate restTemplate = new RestTemplate();

            // Enhanced prompt for movie context
            String enhancedPrompt = "You are EasyBook AI assistant helping users with movie ticket bookings. " +
                    "User question: " + userInput +
                    "\n\nProvide helpful, friendly responses related to movies, bookings, or general assistance. " +
                    "If the question is not about movies, still be helpful but gently guide them back to movie-related topics.";

            String jsonPayload = "{ \"contents\": [{ \"parts\": [{ \"text\": \"" +
                    enhancedPrompt.replace("\"", "\\\"") + "\" }]}]}";

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> entity = new HttpEntity<>(jsonPayload, headers);
            String url = GEMINI_URL + apiKey;

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            System.out.println("🤖 Gemini Response: " + response.getBody());
            return extractTextFromGeminiResponse(response.getBody());

        } catch (Exception e) {
            System.err.println("❌ Gemini API Call Failed: " + e.getMessage());
            return "I'm here to help you with movie bookings! Ask me about available movies, theaters, show timings, or how to book tickets.";
        }
    }

    private String extractTextFromGeminiResponse(String response) {
        try {
            // Simple JSON parsing to extract text from Gemini response
            if (response.contains("\"text\"")) {
                int start = response.indexOf("\"text\":\"") + 8;
                int end = response.indexOf("\"", start);
                if (start > 7 && end > start) {
                    return response.substring(start, end)
                            .replace("\\n", "\n")
                            .replace("\\\"", "\"")
                            .replace("\\\\", "\\");
                }
            }
            return response;
        } catch (Exception e) {
            return "I'm here to help you with movie bookings! How can I assist you today?";
        }
    }
}


