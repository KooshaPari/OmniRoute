package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

// RateLimiterMiddleware implements rate limiting per IP
func RateLimiterMiddleware(limiter *rate.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":     "Too Many Requests",
				"message":   "Rate limit exceeded, please try again later",
				"timestamp": time.Now().Format(time.RFC3339),
				"retry_after": "15m",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// IPRateLimiterMiddleware implements per-IP rate limiting
func IPRateLimiterMiddleware(rps int, burst int) gin.HandlerFunc {
	limiters := make(map[string]*rate.Limiter)
	
	return func(c *gin.Context) {
		ip := c.ClientIP()
		
		limiter, exists := limiters[ip]
		if !exists {
			limiter = rate.NewLimiter(rate.Limit(rps), burst)
			limiters[ip] = limiter
		}
		
		if !limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":     "Too Many Requests",
				"message":   "Rate limit exceeded for your IP, please try again later",
				"timestamp": time.Now().Format(time.RFC3339),
				"retry_after": "15m",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}