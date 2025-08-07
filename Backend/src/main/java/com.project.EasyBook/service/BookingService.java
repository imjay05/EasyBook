package com.project.EasyBook.service;

import com.project.EasyBook.entity.Booking;
import com.project.EasyBook.entity.Seat;
import com.project.EasyBook.entity.Show;
import com.project.EasyBook.entity.User;
import com.project.EasyBook.repository.BookingRepository;
import com.project.EasyBook.repository.SeatRepository;
import com.project.EasyBook.repository.ShowRepository;
import com.project.EasyBook.repository.UserRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class BookingService {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private SeatRepository seatRepository;

    public Booking bookSeats(Integer userId, Integer showId, List<Integer> seats, Double totalPrice) {
        List<Seat> toBook = seatRepository.findByShowShowId(showId).stream()
                .filter(s -> seats.contains(s.getSeatNumber()) && !s.isBooked())
                .collect(Collectors.toList());

        toBook.forEach(s -> s.setBooked(true));
        seatRepository.saveAll(toBook);

        Booking booking = new Booking();
        booking.setUser(new User(userId));
        booking.setShow(new Show(showId));
        booking.setSeatsBooked(String.join((CharSequence) ",", (CharSequence) seats));
        booking.setTotalPrice(BigDecimal.valueOf(totalPrice));
        return bookingRepository.save(booking);
    }

    public Optional<Booking> getBookingById(Integer bookingId) {
        return bookingRepository.findById(bookingId);
    }

    public Booking saveBooking(Booking booking) {
        return bookingRepository.save(booking);
    }
}
