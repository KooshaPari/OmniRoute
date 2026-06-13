use crate::{config::Config, error::Result, Error};
use image::{DynamicImage, ImageFormat};
use std::path::PathBuf;
use tracing::{debug, info};

pub struct ImageProcessor {
    config: Config,
}

impl ImageProcessor {
    pub async fn new(config: Config) -> Result<Self> {
        // Ensure screenshot directory exists
        tokio::fs::create_dir_all(&config.screenshot_dir).await?;
        
        Ok(Self { config })
    }
    
    pub async fn process_image_data(&self, data: &[u8], source: &str) -> Result<PathBuf> {
        debug!("Processing image data from source: {}", source);
        
        // Validate image data
        if data.is_empty() {
            return Err(Error::InvalidInput("Empty image data".to_string()));
        }
        
        if data.len() > self.config.max_file_size as usize {
            return Err(Error::InvalidInput(format!(
                "Image size {} exceeds maximum allowed size {}",
                data.len(),
                self.config.max_file_size
            )));
        }
        
        // Load image
        let img = image::load_from_memory(data)
            .map_err(Error::Image)?;
        
        // Generate filename
        let filename = crate::generate_screenshot_filename(source);
        let output_path = self.config.get_screenshot_path(&filename);
        
        // Process and save image
        self.save_processed_image(&img, &output_path).await?;
        
        info!("Processed image saved to: {:?}", output_path);
        Ok(output_path)
    }
    
    pub async fn process_image_file(&self, input_path: &PathBuf, source: &str) -> Result<PathBuf> {
        debug!("Processing image file: {:?}", input_path);
        
        // Validate input file
        if !input_path.exists() {
            return Err(Error::NotFound(format!("Input file not found: {:?}", input_path)));
        }
        
        let metadata = tokio::fs::metadata(input_path).await?;
        if metadata.len() > self.config.max_file_size {
            return Err(Error::InvalidInput(format!(
                "File size {} exceeds maximum allowed size {}",
                metadata.len(),
                self.config.max_file_size
            )));
        }
        
        // Read and process image
        let data = tokio::fs::read(input_path).await?;
        self.process_image_data(&data, source).await
    }
    
    async fn save_processed_image(&self, img: &DynamicImage, output_path: &PathBuf) -> Result<()> {
        debug!("Saving processed image to: {:?}", output_path);
        
        // Ensure parent directory exists
        if let Some(parent) = output_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        
        // Convert image to PNG with compression
        let processed_img = self.apply_image_processing(img)?;
        
        // Save image
        tokio::task::spawn_blocking({
            let output_path = output_path.clone();
            let processed_img = processed_img.clone();
            move || {
                processed_img.save_with_format(&output_path, ImageFormat::Png)
            }
        }).await.map_err(|e| Error::Internal(format!("Task join error: {}", e)))??;
        
        Ok(())
    }
    
    fn apply_image_processing(&self, img: &DynamicImage) -> Result<DynamicImage> {
        let mut processed = img.clone();
        
        // Apply compression if needed
        if self.config.compression_quality < 100 {
            processed = self.apply_compression(&processed)?;
        }
        
        // Ensure reasonable dimensions (max 4K)
        const MAX_DIMENSION: u32 = 3840;
        if processed.width() > MAX_DIMENSION || processed.height() > MAX_DIMENSION {
            let ratio = (MAX_DIMENSION as f32 / processed.width().max(processed.height()) as f32).min(1.0);
            let new_width = (processed.width() as f32 * ratio) as u32;
            let new_height = (processed.height() as f32 * ratio) as u32;
            
            processed = processed.resize(new_width, new_height, image::imageops::FilterType::Lanczos3);
            debug!("Resized image to {}x{}", new_width, new_height);
        }
        
        Ok(processed)
    }
    
    fn apply_compression(&self, img: &DynamicImage) -> Result<DynamicImage> {
        // For PNG, we can't directly control compression quality, but we can
        // reduce color depth or apply other optimizations
        if self.config.compression_quality < 50 {
            // Apply more aggressive compression by reducing color depth
            let img_rgb8 = img.to_rgb8();
            Ok(DynamicImage::ImageRgb8(img_rgb8))
        } else {
            Ok(img.clone())
        }
    }
    
    pub fn is_supported_format(&self, data: &[u8]) -> bool {
        // Check if the data represents a supported image format
        image::guess_format(data).is_ok()
    }
    
    pub fn get_image_info(&self, data: &[u8]) -> Result<ImageInfo> {
        let img = image::load_from_memory(data)?;
        let format = image::guess_format(data)?;
        
        Ok(ImageInfo {
            width: img.width(),
            height: img.height(),
            format: format_to_string(format),
            size: data.len() as u64,
        })
    }
    
    pub async fn cleanup_temp_files(&self) -> Result<()> {
        let temp_dir = self.config.screenshot_dir.join("temp");
        if temp_dir.exists() {
            tokio::fs::remove_dir_all(&temp_dir).await?;
            tokio::fs::create_dir_all(&temp_dir).await?;
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub struct ImageInfo {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size: u64,
}

fn format_to_string(format: ImageFormat) -> String {
    match format {
        ImageFormat::Png => "PNG".to_string(),
        ImageFormat::Jpeg => "JPEG".to_string(),
        ImageFormat::Gif => "GIF".to_string(),
        ImageFormat::WebP => "WebP".to_string(),
        ImageFormat::Bmp => "BMP".to_string(),
        ImageFormat::Tiff => "TIFF".to_string(),
        _ => "Unknown".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    
    fn create_test_image_data() -> Vec<u8> {
        // Create a simple 1x1 PNG image
        let img = image::RgbImage::new(1, 1);
        let dynamic_img = DynamicImage::ImageRgb8(img);
        
        let mut buffer = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut buffer);
        dynamic_img.write_to(&mut cursor, ImageFormat::Png).unwrap();
        buffer
    }
    
    #[tokio::test]
    async fn test_image_processor_creation() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let processor = ImageProcessor::new(config).await;
        assert!(processor.is_ok());
    }
    
    #[tokio::test]
    async fn test_process_image_data() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let processor = ImageProcessor::new(config).await.unwrap();
        let image_data = create_test_image_data();
        
        let result = processor.process_image_data(&image_data, "test").await;
        assert!(result.is_ok());
        
        let output_path = result.unwrap();
        assert!(output_path.exists());
        assert!(output_path.to_string_lossy().contains("test"));
    }
    
    #[tokio::test]
    async fn test_image_format_detection() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let processor = ImageProcessor::new(config).await.unwrap();
        let image_data = create_test_image_data();
        
        assert!(processor.is_supported_format(&image_data));
        
        let invalid_data = b"not an image";
        assert!(!processor.is_supported_format(invalid_data));
    }
    
    #[tokio::test]
    async fn test_image_info() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let processor = ImageProcessor::new(config).await.unwrap();
        let image_data = create_test_image_data();
        
        let info = processor.get_image_info(&image_data).unwrap();
        assert_eq!(info.width, 1);
        assert_eq!(info.height, 1);
        assert_eq!(info.format, "PNG");
        assert!(info.size > 0);
    }
    
    #[tokio::test]
    async fn test_invalid_image_data() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        
        let processor = ImageProcessor::new(config).await.unwrap();
        
        // Test empty data
        let result = processor.process_image_data(&[], "test").await;
        assert!(result.is_err());
        
        // Test invalid data
        let invalid_data = b"not an image";
        let result = processor.process_image_data(invalid_data, "test").await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_file_size_limit() {
        let temp_dir = TempDir::new().unwrap();
        let mut config = Config::default();
        config.screenshot_dir = temp_dir.path().to_path_buf();
        config.max_file_size = 10; // Very small limit - smaller than any image
        
        let processor = ImageProcessor::new(config).await.unwrap();
        let image_data = create_test_image_data();
        
        let result = processor.process_image_data(&image_data, "test").await;
        assert!(result.is_err());
    }
}