<?php
// AI Assistant Configuration

// Ollama server settings
$AI_CONFIG = array(
    'OLLAMA_SERVER' => 'http://localhost:11434',
    'OLLAMA_MODEL' => 'qwen3:14b',
    'TIMEOUT' => 30,
    
    // Available models
    'AVAILABLE_MODELS' => array(
        'codellama:13b' => 'Code Llama - Best for code generation',
        'qwen3:14b' => '',
        'deepseek-r1:14b' => '',
    )
);

// Function to get AI configuration
function getAIConfig() {
    global $AI_CONFIG;
    return $AI_CONFIG;
}

// Function to update AI configuration
function updateAIConfig($key, $value) {
    global $AI_CONFIG;
    $AI_CONFIG[$key] = $value;
}

?>
