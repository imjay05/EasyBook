package com.project.EasyBook.controller;

import com.project.EasyBook.dto.BookingRequest;
import com.project.EasyBook.entity.*;
import com.project.EasyBook.repository.*;
import com.project.EasyBook.service.BookingService;
import com.project.EasyBook.service.PaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TheaterRepository theaterRepository;

    @Autowired
    private ShowRepository showRepository;

    @Autowired
    private SeatRepository seatRepository;

    @Autowired
    private MovieRepository movieRepository;


    @GetMapping("/movies")
    public List<Movie> getAllMovies() {
        return movieRepository.findAll();
    }

    @GetMapping("/cities/{movieId}")
    public ResponseEntity<?> getCitiesByMovie(@PathVariable int movieId) {
        try {
            List<String> cities = showRepository.findAll().stream()
                    .filter(s -> s.getMovie() != null && s.getTheater() != null)
                    .filter(s -> s.getMovie().getMovieId() == movieId)
                    .map(s -> s.getTheater().getCity())
                    .filter(city -> city != null)
                    .distinct()
                    .toList();
            return ResponseEntity.ok(cities);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error fetching cities: " + e.getMessage());
        }
    }

    @GetMapping("/theaters/{movieId}/{city}")
    public List<Theater> getTheaters(@PathVariable int movieId, @PathVariable String city) {
        return showRepository.findAll().stream()
                .filter(s -> s.getMovie().getMovieId() == movieId && s.getTheater().getCity().equals(city))
                .map(Show::getTheater).distinct().toList();
    }

    @GetMapping("/shows/{movieId}/{theaterId}")
    public List<Show> getShows(@PathVariable int movieId, @PathVariable int theaterId) {
        return showRepository.findAll().stream()
                .filter(s -> s.getMovie().getMovieId() == movieId && s.getTheater().getTheaterId() == theaterId)
                .toList();
    }

    @GetMapping("/seats/{showId}")
    public List<Seat> getSeats(@PathVariable int showId) {
        return seatRepository.findByShowShowId(showId);
    }

    @PostMapping("/create-booking-order")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> createBookingOrder(@RequestBody BookingRequest request) {
        try {
            if (request.getSeats() == null || request.getSeats().isEmpty()) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "No seats selected"));
            }

            Show show = showRepository.findById(request.getShowId())
                    .orElseThrow(() -> new RuntimeException("Show not found"));

            List<Seat> requestedSeats = seatRepository.findBySeatIdIn(request.getSeats());
            if (requestedSeats.size() != request.getSeats().size()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "One or more seats not found"
                ));
            }

            if (requestedSeats.stream().anyMatch(Seat::getBooked)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Some seats already booked"
                ));
            }

            PaymentOrder paymentOrder = new PaymentOrder();
            paymentOrder.setName("Guest");
            paymentOrder.setEmail("guest@example.com");
            paymentOrder.setPhone("9999999999");
            paymentOrder.setMovieName("Movie: " + show.getMovie().getTitle() +
                    " - " + show.getTheater().getName() +
                    " - " + show.getShowId());
            paymentOrder.setAmount(request.getTotalPrice());

            String razorpayOrder = paymentService.createOrder(paymentOrder);


            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Payment order created",
                    "razorpayOrder", razorpayOrder,
                    "orderId", paymentOrder.getOrderId(),
                    "amount", paymentOrder.getAmount(),
                    "bookingData", Map.of(
                            "showId", request.getShowId(),
                            "seats", request.getSeats(),
                            "totalPrice", request.getTotalPrice()
                    )
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "error",
                    "message", e.getMessage()
            ));
        }
    }

    @PostMapping("/payment/create-order")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> createPaymentOrder(@RequestBody PaymentOrder orderDetails) {
        try {
            String response = paymentService.createOrder(orderDetails);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "Failed to create payment order: " + e.getMessage()
            ));
        }
    }


    @PostMapping("/confirm-booking")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> confirmBooking(@RequestBody Map<String, Object> request) {
        if (request == null) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body("Invalid booking data. Please try again.");
        }

        String bookingId = (String) request.get("bookingId");
        try {
            String paymentId = (String) request.get("paymentId");
            String orderId = (String) request.get("orderId");
            String signature = (String) request.get("signature");

            Map<String, Object> bookingData = (Map<String, Object>) request.get("bookingData");
            Integer userId = (Integer) bookingData.get("userId");
            Integer showId = (Integer) bookingData.get("showId");
            List<Integer> seats = (List<Integer>) bookingData.get("seats");
            Double totalPrice = (Double) bookingData.get("totalPrice");

            boolean isValidSignature = paymentService.verifySignature(paymentId, orderId, signature);

            if (!isValidSignature) {
                paymentService.updateOrderStatus(paymentId, orderId, "FAILED");
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Payment verification failed"
                ));
            }

            List<Seat> requestedSeats = seatRepository.findBySeatIdIn(seats);
            if (requestedSeats.stream().anyMatch(Seat::getBooked)) {
                paymentService.updateOrderStatus(paymentId, orderId, "FAILED");
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Some seats are no longer available"
                ));
            }
            paymentService.updateOrderStatus(paymentId, orderId, "SUCCESS");

            Booking booking = bookingService.bookSeats(
                    userId,
                    showId,
                    seats,
                    totalPrice
            );

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Booking confirmed successfully",
                    "bookingId", booking.getBookingId(),
                    "seats", booking.getSeatsBooked(),
                    "total", booking.getTotalPrice(),
                    "paymentId", paymentId
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "error",
                    "message", e.getMessage()
            ));
        }
    }

    @PutMapping("/bookings/update-payment")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> updatePaymentStatus(@RequestBody BookingRequest request) {
        if(request.getBookingId() == null || request.getPaymentId() == null){
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Missing bookingId or paymentId"));
        }
        try {
            if (request.getSeats() == null || request.getSeats().isEmpty()) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "No seats selected"));
            }

            Show show = showRepository.findById(request.getShowId())
                    .orElseThrow(() -> new RuntimeException("Show not found"));

            List<Seat> requestedSeats = seatRepository.findBySeatIdIn(request.getSeats());
            if (requestedSeats.size() != request.getSeats().size()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "One or more seats not found"
                ));
            }

            if (requestedSeats.stream().anyMatch(Seat::getBooked)) {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "error",
                        "message", "Some seats already booked"
                ));
            }

            // Create payment order
            PaymentOrder paymentOrder = new PaymentOrder();
            paymentOrder.setName("Guest");
            paymentOrder.setEmail("guest@example.com");
            paymentOrder.setPhone("9999999999");
            paymentOrder.setMovieName("Movie: " + show.getMovie().getTitle() +
                    " - " + show.getTheater().getName() +
                    " - " + show.getShowId());
            paymentOrder.setAmount(request.getTotalPrice());

            String razorpayOrder = paymentService.createOrder(paymentOrder);

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Payment order created",
                    "razorpayOrder", razorpayOrder,
                    "orderId", paymentOrder.getOrderId(),
                    "amount", paymentOrder.getAmount(),
                    "bookingData", Map.of(
                            "showId", request.getShowId(),
                            "seats", request.getSeats(),
                            "totalPrice", request.getTotalPrice()
                    )
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "status", "error",
                    "message", e.getMessage()
            ));
        }
    }


    @PostMapping("/book")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> bookSeats(@RequestBody BookingRequest request) {
        Integer bookingId = request.getBookingId();
        try {

            Show show = showRepository.findById(request.getShowId())
                    .orElseThrow(() -> new RuntimeException("Invalid show"));

            Booking booking = new Booking();
             booking.setShow(showRepository.findById(request.getShowId())
                   .orElseThrow(() -> new RuntimeException("Invalid show")));

            List<String> seatStrings = request.getSeats().stream()
                    .map(String::valueOf)
                    .collect(Collectors.toList());

            booking.setSeatsBooked(String.join(",", seatStrings));
            booking.setTotalPrice(BigDecimal.valueOf(request.getTotalPrice()));
            Booking savedBooking = bookingService.saveBooking(booking);

            return ResponseEntity.ok(Map.of("message", "Booking successful!", "status", "success", "booking" , savedBooking.getBookingId()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage(), "status", "error"
                    ));
        }
    }

    @GetMapping("/chat/movies-info")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> getChatMoviesInfo() {
        try {
            Map<String, Object> info = new HashMap<>();
            info.put("totalMovies", movieRepository.count());
            info.put("totalTheaters", theaterRepository.count());
            info.put("totalShows", showRepository.count());

            List<String> cities = theaterRepository.findAll().stream()
                    .map(Theater::getCity)
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());
            info.put("availableCities", cities);

            List<Map<String, Object>> moviesList = movieRepository.findAll().stream()
                    .limit(20)
                    .map(movie -> {
                        Map<String, Object> movieInfo = new HashMap<>();
                        movieInfo.put("id", movie.getMovieId());
                        movieInfo.put("title", movie.getTitle());
                        movieInfo.put("genre", movie.getGenre());
                        movieInfo.put("language", movie.getLang());
                        movieInfo.put("duration", movie.getDuration());
                        return movieInfo;
                    })
                    .collect(Collectors.toList());
            info.put("recentMovies", moviesList);

            return ResponseEntity.ok(info);
        }
        catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch chat info"));
        }
    }

    @GetMapping("/chat/search-movies/{query}")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> searchMovies(@PathVariable String query) {
        try {
            List<Movie> movies = movieRepository.findAll().stream()
                    .filter(movie -> movie.getTitle().toLowerCase().contains(query.toLowerCase()) ||
                            (movie.getGenre() != null && movie.getGenre().toLowerCase().contains(query.toLowerCase())) ||
                            (movie.getLang() != null && movie.getLang().toLowerCase().contains(query.toLowerCase())))
                    .collect(Collectors.toList());

            if (movies.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "message", "No movies found matching: " + query,
                        "movies", new ArrayList<>()
                ));
            }

            List<Map<String, Object>> moviesList = movies.stream()
                    .map(movie -> {
                        Map<String, Object> movieInfo = new HashMap<>();
                        movieInfo.put("id", movie.getMovieId());
                        movieInfo.put("title", movie.getTitle());
                        movieInfo.put("genre", movie.getGenre());
                        movieInfo.put("language", movie.getLang());
                        movieInfo.put("duration", movie.getDuration());

                        // Add show information
                        List<Show> shows = showRepository.findAll().stream()
                                .filter(show -> show.getMovie() != null &&
                                        show.getMovie().getMovieId() == movie.getMovieId())
                                .collect(Collectors.toList());

                        movieInfo.put("totalShows", shows.size());
                        movieInfo.put("cities", shows.stream()
                                .map(show -> show.getTheater().getCity())
                                .distinct()
                                .collect(Collectors.toList()));

                        return movieInfo;
                    })
                    .collect(Collectors.toList());

            return ResponseEntity.ok(Map.of(
                    "message", "Found " + movies.size() + " movie(s) for: " + query,
                    "movies", moviesList
            ));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Search failed: " + e.getMessage()));
        }
    }

    @GetMapping("/chat/movie/{movieId}/details")
    @CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"})
    public ResponseEntity<?> getMovieDetails(@PathVariable int movieId) {
        try {
            Optional<Movie> movieOpt = movieRepository.findById(movieId);
            if (movieOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Movie not found"));
            }

            Movie movie = movieOpt.get();
            Map<String, Object> movieDetails = new HashMap<>();
            movieDetails.put("id", movie.getMovieId());
            movieDetails.put("title", movie.getTitle());
            movieDetails.put("genre", movie.getGenre());
            movieDetails.put("language", movie.getLang());
            movieDetails.put("duration", movie.getDuration());

            List<Show> shows = showRepository.findAll().stream()
                    .filter(show -> show.getMovie() != null &&
                            show.getMovie().getMovieId() == movieId)
                    .collect(Collectors.toList());

            Map<String, List<Map<String, Object>>> cityWiseShows = shows.stream()
                    .collect(Collectors.groupingBy(
                            show -> show.getTheater().getCity(),
                            Collectors.mapping(show -> {
                                Map<String, Object> showInfo = new HashMap<>();
                                showInfo.put("showId", show.getShowId());
                                showInfo.put("theater", show.getTheater().getName());
                                showInfo.put("timing", show.getTiming());
                                showInfo.put("availableSeats", show.getAvailableSeats());
                                return showInfo;
                            }, Collectors.toList())
                    ));

            movieDetails.put("shows", cityWiseShows);
            movieDetails.put("totalShows", shows.size());
            movieDetails.put("cities", cityWiseShows.keySet());

            return ResponseEntity.ok(movieDetails);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch movie details: " + e.getMessage()));
        }
    }
}
