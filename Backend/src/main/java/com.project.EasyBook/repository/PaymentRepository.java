package com.project.EasyBook.repository;

import com.project.EasyBook.entity.PaymentOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PaymentRepository extends JpaRepository<PaymentOrder, Long> {
    PaymentOrder findByOrderId(String orderId);
}
