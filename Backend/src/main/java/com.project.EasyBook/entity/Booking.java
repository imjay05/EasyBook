package com.project.EasyBook.entity;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "bookings")
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int bookingId;

    @ManyToOne
    private User user;

    @ManyToOne
    private Show show;

    private String seatsBooked;

    @Column(nullable = false)
    private BigDecimal totalPrice;

    public Booking() {
    }

    public Booking(int bookingId, User user, Show show, String seatsBooked, BigDecimal totalPrice) {
        this.bookingId = bookingId;
        this.user = user;
        this.show = show;
        this.seatsBooked = seatsBooked;
        this.totalPrice = totalPrice;
    }

    public int getBookingId() {
        return bookingId;
    }

    public void setBookingId(int bookingId) {
        this.bookingId = bookingId;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Show getShow() {
        return show;
    }

    public void setShow(Show show) {
        this.show = show;
    }

    public String getSeatsBooked() {
        return seatsBooked;
    }

    public void setSeatsBooked(String seatsBooked) {
        this.seatsBooked = seatsBooked;
    }

    public BigDecimal getTotalPrice() {
        return totalPrice;
    }

    public void setTotalPrice(BigDecimal totalPrice) {
        this.totalPrice = totalPrice;
    }
}
