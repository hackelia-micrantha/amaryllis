#!/bin/bash

# Redirect to Gemma3-1B-IT INT4 .task file (Hugging Face)
echo "🔗 Opening Gemma3-1B-IT INT4 task file page..."
xdg-open "https://huggingface.co/litert-community/Gemma3-1B-IT/tree/main" || open "https://huggingface.co/litert-community/Gemma3-1B-IT/tree/main"

# Redirect to MobileNetV3-Small .tflite model (TensorFlow Hub)
echo "🔗 Opening MobileNetV3-Small TFLite model page..."
xdg-open "https://tfhub.dev/google/lite-model/mobilenet_v3_small_100_224/classification/5" || open "https://tfhub.dev/google/lite-model/mobilenet_v3_small_100_224/classification/5"
