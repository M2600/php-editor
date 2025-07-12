# php-editor
php editor for programming education

## Features
- Web-based PHP code editor with syntax highlighting
- File management system
- AI-powered coding assistance with Ollama integration
- Code suggestions, explanations, and refactoring
- Real-time syntax checking
- QR code generation for easy mobile access

## AI Assistant Features
The PHP editor now includes AI-powered coding assistance using Ollama:

### Available AI Functions:
- **Code Suggestions**: Get intelligent code completion suggestions
- **Code Explanation**: Understand what your code does
- **Code Refactoring**: Improve code quality and structure
- **Error Fixing**: Get help fixing syntax and logic errors

### Keyboard Shortcuts:
- `Ctrl+Space` (or `Cmd+Space` on Mac): AI Code Suggestion
- `Ctrl+Alt+Space`: AI Code Completion
- `Ctrl+Alt+E`: AI Code Explanation
- `Ctrl+Alt+R`: AI Code Refactoring

### Setup AI Assistant:
1. Install Ollama on your server:
   ```bash
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

2. Pull a coding model (recommended: codellama):
   ```bash
   ollama pull codellama
   ```

3. Start Ollama server:
   ```bash
   ollama serve
   ```

4. Configure AI settings in `api/ai_config.php`:
   - Update `OLLAMA_SERVER` URL if running on a different server
   - Change `OLLAMA_MODEL` to your preferred model

### Available Models:
- `codellama`: Specialized for code generation (recommended)
- `llama3`: General purpose language model
- `mistral`: Fast and efficient model
- `deepseek-coder`: Specialized coding model
- `codegemma`: Google's code-focused model

### Testing AI Integration:
Visit `/ai_test.html` to test the AI functionality before using it in the editor.

## Installation
1. Clone the repository
2. Set up a PHP web server
3. Configure session management
4. (Optional) Set up Ollama for AI features
5. Access the editor through your web browser

## Usage
1. Login to the system
2. Use the file explorer to navigate and create files
3. Edit code with syntax highlighting
4. Use AI assistance features for better coding experience
5. Save and run your PHP scripts

## File Structure
- `api/`: Backend API endpoints
- `js/`: JavaScript files including AI assistant
- `css/`: Stylesheets
- `templates/`: HTML templates
- `MEditor/`: Custom editor component
