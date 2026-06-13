package middleware

import (
	"github.com/gin-gonic/gin"
)

// SecurityHeadersMiddleware adds security headers to responses
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Content Security Policy
		c.Header("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: https:; connect-src 'self' wss:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'")
		
		// X-Content-Type-Options
		c.Header("X-Content-Type-Options", "nosniff")
		
		// X-Frame-Options
		c.Header("X-Frame-Options", "DENY")
		
		// X-XSS-Protection
		c.Header("X-XSS-Protection", "1; mode=block")
		
		// Referrer-Policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		
		// Strict-Transport-Security (only for HTTPS)
		if c.Request.TLS != nil {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		
		// X-Permitted-Cross-Domain-Policies
		c.Header("X-Permitted-Cross-Domain-Policies", "none")
		
		// Feature-Policy
		c.Header("Feature-Policy", "microphone 'none'; camera 'none'; location 'none'")

		c.Next()
	}
}