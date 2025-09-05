#!/usr/bin/env bash

type hf >/dev/null

if [ $? -ne 0 ]; then
  echo "Please install huggingface_hub"
  exit 1
fi

hf download litert-community/Gemma3-1B-IT gemma3-1b-it-int4.task
