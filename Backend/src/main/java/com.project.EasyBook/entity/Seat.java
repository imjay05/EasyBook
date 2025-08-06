package com.project.EasyBook.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "seat")
public class Seat {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer seatId;

    @ManyToOne
    @JoinColumn(name = "show_id")
    private Show show;

    @Column(name = "seat_number")
    private String seatNumber;

    @Column(name = "is_booked")
    private Boolean isBooked = false;

    public Seat() {
    }

    public Seat(Integer seatId, Show show, String seatNumber, Boolean isBooked) {
        this.seatId = seatId;
        this.show = show;
        this.seatNumber = seatNumber;
        this.isBooked = isBooked;
    }

    public Integer getSeatId() {
        return seatId;
    }

    public void setSeatId(Integer seatId) {
        this.seatId = seatId;
    }

    public Show getShow() {
        return show;
    }

    public void setShow(Show show) {
        this.show = show;
    }

    public String getSeatNumber() {
        return seatNumber;
    }

    public void setSeatNumber(String seatNumber) {
        this.seatNumber = seatNumber;
    }

    public Boolean getBooked() {
        return isBooked;
    }

    public void setBooked(Boolean booked) {
        isBooked = booked;
    }

    public boolean isBooked() {
        return Boolean.TRUE.equals(this.isBooked);
    }
}
