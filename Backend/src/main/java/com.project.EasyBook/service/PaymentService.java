package com.project.EasyBook.service;

import com.project.EasyBook.entity.PaymentOrder;
import com.project.EasyBook.repository.PaymentRepository;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class PaymentService {

    @Value("${razorpay.key_id}")
    private String keyId;

    @Value("${razorpay.key_secret}")
    private String keySecret;

    @Autowired
    private PaymentRepository paymentRepository;

    public String createOrder(PaymentOrder orderDetails) throws RazorpayException {
        RazorpayClient client = new RazorpayClient(keyId, keySecret);

        // Create JSON object for order
        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", (int)(orderDetails.getAmount() * 100)); // Convert to paise
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "txn_" + UUID.randomUUID());

        // Create order
        Order razorpayOrder = client.orders.create(orderRequest);
        System.out.println(razorpayOrder.toString());

        // Save order details
        orderDetails.setOrderId(razorpayOrder.get("id"));
        orderDetails.setStatus("CREATED");
        orderDetails.setCreatedAt(LocalDateTime.now());
        paymentRepository.save(orderDetails);

        return razorpayOrder.toString();
    }

    public void updateOrderStatus(String paymentId, String orderId, String status) {
        PaymentOrder order = paymentRepository.findByOrderId(orderId);
        if (order != null) {
            order.setPaymentId(paymentId);
            order.setStatus(status);
            paymentRepository.save(order);
        }
    }

    public boolean verifySignature(String paymentId, String orderId, String signature) {
        try {
            JSONObject options = new JSONObject();
            options.put("razorpay_order_id", orderId);
            options.put("razorpay_payment_id", paymentId);
            options.put("razorpay_signature", signature);

            return Utils.verifyPaymentSignature(options, keySecret);
        } catch (Exception e) {
            System.err.println("Error verifying signature: " + e.getMessage());
            return false;
        }
    }
}