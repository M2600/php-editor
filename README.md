# php-editor
php editor for programming education

## Features
- Web-based PHP code editor with syntax highlighting
- File management system with full CRUD operations
- AI-powered coding assistance with LMStudio integration
- Interactive AI chat with file context awareness
- Persistent chat history across browser sessions
- Real-time syntax checking and error detection
- Theme support (light/dark mode) with consistent AI interface
- QR code generation for easy mobile access
- Secure API key management with Git protection

## AI Assistant Features
The PHP editor now includes AI-powered coding assistance using LMStudio API:

### Available AI Functions:
- **Code Suggestions**: Get intelligent code completion suggestions
- **Code Explanation**: Understand what your code does
- **Code Refactoring**: Improve code quality and structure
- **Error Fixing**: Get help fixing syntax and logic errors
- **Real-time Chat**: Interactive AI assistant with file context awareness

### AI Chat Features:
- **File Context Sharing**: AI can analyze your current file content
- **Chat History**: Conversations are saved in browser storage and persist across sessions
- **Markdown Support**: AI responses are formatted with syntax highlighting
- **Theme Integration**: Chat interface adapts to light/dark theme

### Setup AI Assistant:

#### Method 1: LMStudio (Recommended)
1. Download and install LMStudio from [lmstudio.ai](https://lmstudio.ai)

2. Load a coding model in LMStudio (recommended models):
   - `codellama`
   - `deepseek-coder`
   - `codegemma`

3. Start LMStudio server and note the API endpoint

4. Configure AI settings:
   ```bash
   # Copy the sample configuration
   cp api/ai_config.sample.php api/ai_config.php
   
   # Edit the configuration file
   nano api/ai_config.php
   ```

5. Update `api/ai_config.php` with your settings:
   ```php
   <?php
   return [
       'lmstudio_api_url' => 'http://your-lmstudio-server:1234/v1/chat/completions',
       'api_key' => 'your-api-key-here',
   ];
   ```

#### Method 2: Other OpenAI-Compatible APIs
You can also use other OpenAI-compatible APIs by updating the `lmstudio_api_url` and `api_key` in the configuration file.

### Security Note:
- The `ai_config.php` file is excluded from Git to protect your API keys
- Never commit API keys to version control
- Use the provided `ai_config.sample.php` as a template

## Installation
1. Clone the repository
2. Set up a PHP web server (Apache, Nginx, or PHP built-in server)
3. Configure session management
4. Set up AI features (see AI Assistant Features section)
5. Configure AI settings by copying `api/ai_config.sample.php` to `api/ai_config.php`
6. Access the editor through your web browser

## Usage
1. Login to the system
2. Use the file explorer to navigate and create files
3. Edit code with syntax highlighting and auto-completion
4. Use the AI chat assistant for coding help and explanations
5. AI automatically analyzes your current file for context-aware assistance
6. Chat history is automatically saved and restored between sessions
7. Save and run your PHP scripts with built-in syntax checking

## File Structure
- `api/`: Backend API endpoints
  - `ai.php`: AI chat API endpoint
  - `ai_config.php`: AI configuration (not tracked in Git)
  - `ai_config.sample.php`: Sample AI configuration template
  - `file_manager.php`: File management API
- `js/`: JavaScript files including AI assistant
  - `meditor.js`: Main editor functionality with AI integration
  - `ai_api.js`: AI API client
- `css/`: Stylesheets with theme support
- `templates/`: HTML templates
- `MEditor/`: Custom editor component with AI chat interface

## Configuration Files
- `api/ai_config.php`: Contains sensitive API keys (excluded from Git)
- `api/ai_config.sample.php`: Template for AI configuration
- `.gitignore`: Includes `api/ai_config.php` to protect API keys

## Security Best Practices
- Never commit API keys to version control
- Use the provided configuration file structure to keep sensitive data separate
- The `ai_config.php` file is automatically excluded from Git tracking
- Regularly rotate your API keys for better security

## Troubleshooting
### AI Chat Issues
- **"AI設定ファイルが見つかりません"**: Copy `ai_config.sample.php` to `ai_config.php` and configure your settings
- **"APIキーが設定されていません"**: Update the `api_key` value in `ai_config.php` with your actual API key
- **Chat history not persisting**: Check browser storage permissions and clear corrupted localStorage if needed
- **AI responses not formatted**: Ensure the AI endpoint returns valid markdown and check console for JavaScript errors

### General Issues
- **File upload failures**: Check server permissions for the upload directory
- **Syntax errors not displaying**: Verify PHP CLI is available and accessible by the web server
- **Theme not switching**: Clear browser cache and check CSS file permissions

## Development
This project is actively developed with the following branch structure:
- `main`: Stable release branch
- `beta`: Testing branch with latest features
- `AI`: AI features development branch
- `dev`: General development branch

## Recent Updates
- ✅ Migrated from Ollama to LMStudio API for better compatibility
- ✅ Implemented secure API key management with separate configuration files
- ✅ Added persistent chat history using browser localStorage
- ✅ Enhanced AI chat interface with markdown rendering and theme integration
- ✅ Removed API keys from Git history for improved security
- ✅ Added comprehensive error handling and user feedback

## Contributing
1. Fork the repository
2. Create a feature branch
3. Ensure API keys are properly configured using the sample template
4. Test AI functionality before submitting changes
5. Submit a pull request with detailed description of changes

## License
This project is designed for educational purposes in programming education.
