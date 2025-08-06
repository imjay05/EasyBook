package com.project.EasyBook.config;

import com.project.EasyBook.controller.EasyBookChatHandler;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final EasyBookChatHandler easyBookChatHandler;

    @Autowired
    public WebSocketConfig(EasyBookChatHandler easyBookChatHandler){
        this.easyBookChatHandler = easyBookChatHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(easyBookChatHandler, "/api/chat")
                .setAllowedOrigins("http://localhost:3000", "http://127.0.0.1:3000");
    }
}
