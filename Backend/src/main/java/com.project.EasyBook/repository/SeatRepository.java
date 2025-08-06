package com.project.EasyBook.repository;

import com.project.EasyBook.entity.Seat;
import com.project.EasyBook.entity.Show;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SeatRepository extends JpaRepository<Seat, Integer> {
    List<Seat> findByShowShowId(Integer showId);

    List<Seat> findBySeatIdIn(List<Integer> seatIds);
}
