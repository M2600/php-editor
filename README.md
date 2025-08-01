# php-editor
php editor for programming education

## Features
- Web-based PHP code editor with syntax highlighting
- File management system with full CRUD operations
- AI-powered coding assistance with LMStudio integration
- Interactive AI chat with file context awareness
- Persistent chat history across browser sessions
- #### Complete Setup Commands

**1. Create Nginx Configuration**:
```bash
sudo tee /etc/nginx/sites-available/php-editor > /dev/null << 'EOF'
server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root /var/www/html/php-editor;
	index index.html index.htm index.nginx-debian.html index.p## Configuration Files
- `api/ai_config.php`: Contains sensitive API keys (excluded from Git)
- `api/ai_config.sample.php`: Template for AI configuration
- `.gitignore`: Includes `api/ai_config.php` to protect API keys
- `man.txt`: Internal documentation with configuration details and troubleshooting notes
- **Server Configuration** (create manually - not in repository):
  - `/etc/nginx/sites-available/php-editor`: nginx virtual host configuration
  - `/etc/php/8.3/fpm/pool.d/www_userphp.conf`: User programs PHP-FPM pool
  - `/var/www/html/user-programs/php.ini`: User programs PHP configuration
- `user-programs/`: User code execution directory
  - `.composer/`: Composer dependencies for user programs
  - `php.ini`: User programs specific PHP configuration

## Security Best Practices;
	charset UTF-8;
	
	location ~ /\. {
		return 404;
	}

	location ~ \.md$ {
		return 404;
	}

	location / {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;
	}

	location ~ ^/user-programs/ {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;

		# Cache control 
		add_header Cache-control "no-store";
		add_header Pragma "no-cache";

		# CORS headers
		add_header 'Access-Control-Allow-Origin' https://example.com always;
	    	add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
	    	add_header 'Access-Control-Allow-Headers' 'X-Requested-With, Content-Type' always;

		location ~ \.php$ {
			include snippets/fastcgi-php.conf;
			fastcgi_pass unix:/run/php/php8.3-fpm_userphp.sock;
		}

		location ~ \.ini$ {
			return 404;		
		}
	}

	location ~ \.php$ {
		include snippets/fastcgi-php.conf;
		fastcgi_pass unix:/run/php/php8.3-fpm.sock;
	}
}
EOF
```

**2. Create User PHP Pool Configuration**:
```bash
sudo tee /etc/php/8.3/fpm/pool.d/www_userphp.conf > /dev/null << 'EOF'
; Start a new pool named 'www_userphp' for user programs
[www_userphp]

; Unix user/group of processes
user = www-data
group = www-data

; The address on which to accept FastCGI requests
listen = /run/php/php8.3-fpm_userphp.sock

; Set permissions for unix socket
listen.owner = www-data
listen.group = www-data

; Process manager configuration
pm = dynamic
pm.max_children = 20
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5

; Additional security for user programs
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
php_admin_flag[allow_url_fopen] = off
php_admin_flag[allow_url_include] = off

; Session security settings
php_admin_flag[session.cookie_httponly] = on

; Composer autoload for user programs
php_admin_value[auto_prepend_file] = /var/www/html/user-programs/.composer/vendor/autoload.php
EOF
```

**3. Update PHP-FPM Main Configuration** (add session security):
```bash
# Add session security to main PHP configuration
echo 'session.cookie_httponly = On' | sudo tee -a /etc/php/8.3/fpm/php.ini
```

**4. Create User Programs PHP Configuration**:
```bash
sudo mkdir -p /var/www/html/user-programs
sudo tee /var/www/html/user-programs/php.ini > /dev/null << 'EOF'
; User Programs PHP Configuration
; Disable dangerous functions
disable_functions = exec,passthru,shell_exec,system,proc_open,popen

; File operation restrictions
allow_url_fopen = Off
allow_url_include = Off

; Composer autoload
auto_prepend_file = /var/www/html/user-programs/.composer/vendor/autoload.php

; Session security
session.cookie_httponly = On
EOF
```

**5. Enable Site and Restart Services**:
```bash
# Enable nginx site
sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/

# Test configurations
sudo nginx -t
sudo php-fpm8.3 -t

# Restart services
sudo systemctl restart nginx
sudo systemctl restart php8.3-fpm
```

- Secure API key management with Git protection
- Production-ready deployment with nginx support

## AI Assistant Features
The PHP editor now includes AI-powered coding assistance using LMStudio API:

### Available AI Functions:
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

### Nginx Configuration (Recommended)

#### Prerequisites
- Nginx web server (tested with nginx 1.18.0)
- PHP 8.3 with PHP-FPM
- PHP modules: curl, json, session, cgi
- Composer (for user program dependencies)

#### Environment Details
This configuration has been tested on:
- **OS**: Linux Mint 21.3 x86_64
- **Web Server**: nginx 1.18.0
- **PHP**: PHP-FPM 8.3 with php-curl, php-cgi
- **Package Manager**: Composer

#### Complete Nginx Configuration
Save this as `/etc/nginx/sites-available/php-editor`:

```nginx
server {
	listen 80 default_server;
	listen [::]:80 default_server;

	root /var/www/html/php-editor;
	index index.html index.htm index.nginx-debian.html index.php;
	server_name _;
	charset UTF-8;
	
	location ~ /\. {
		return 404;
	}

	location ~ \.md$ {
		return 404;
	}

	location / {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;
	}

	location ~ ^/user-programs/ {
		root /var/www/html/php-editor/;
		try_files $uri $uri/ =404;

		# Cache control 
		add_header Cache-control "no-store";
		add_header Pragma "no-cache";

		# CORS headers
		add_header 'Access-Control-Allow-Origin' https://example.com always;
	    	add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
	    	add_header 'Access-Control-Allow-Headers' 'X-Requested-With, Content-Type' always;

		location ~ \.php$ {
			include snippets/fastcgi-php.conf;
			fastcgi_pass unix:/run/php/php8.3-fpm_userphp.sock;
		}

		location ~ \.ini$ {
			return 404;		
		}
	}

	location ~ \.php$ {
		include snippets/fastcgi-php.conf;
		fastcgi_pass unix:/run/php/php8.3-fpm.sock;
	}
```

#### PHP-FPM Configuration

**Key Configuration Notes:**
- Replace `https://example.com` in CORS headers with your actual domain
- The configuration uses two PHP-FPM pools:
  - `unix:/run/php/php8.3-fpm.sock` for main application
  - `unix:/run/php/php8.3-fpm_userphp.sock` for user programs (separate pool)
- Update `server_name` and `root` path as needed

#### Installation Steps
1. **Create the nginx configuration file**:
   ```bash
   sudo nano /etc/nginx/sites-available/php-editor
   ```
   Copy the nginx configuration shown above.

2. **Create the user PHP pool configuration**:
   ```bash
   sudo nano /etc/php/8.3/fpm/pool.d/www_userphp.conf
   ```
   Copy the www_userphp pool configuration shown above.

3. **Update domain and paths in the configuration files**:
   - Replace `https://example.com` with your actual domain in CORS headers
   - Update `/var/www/html/php-editor` paths if using a different installation directory

4. **Enable the site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/
   ```

5. **Create user programs directory and configuration**:
   ```bash
   sudo mkdir -p /var/www/html/user-programs
   # Create user-programs php.ini as shown in the Complete Setup Commands section
   ```

6. **Test and reload services**:
   ```bash
   sudo nginx -t
   sudo php-fpm8.3 -t
   sudo systemctl restart nginx
   sudo systemctl restart php8.3-fpm
   ```

#### PHP-FPM Pool Configuration
Main pool configuration excerpt:

```ini
; Start a new pool named 'www'.
[www]

; Unix user/group of the child processes
user = www-data
group = www-data

; The address on which to accept FastCGI requests
listen = /run/php/php8.3-fpm.sock

; Set permissions for unix socket
listen.owner = www-data
listen.group = www-data

; Choose how the process manager will control the number of child processes
; Possible Values: static, dynamic, ondemand
pm = dynamic

; The maximum number of child processes that can be alive at the same time
pm.max_children = 50

; The number of child processes created on startup
pm.start_servers = 5

; The minimum number of child processes in 'idle' state
pm.min_spare_servers = 5

; The maximum number of child processes in 'idle' state
pm.max_spare_servers = 35
```

**Note**: The server configuration includes a separate pool (`www_userphp`) for user program execution, which provides additional security isolation.

#### PHP Pool Architecture Details
php-editor uses two distinct PHP-FPM pools for security and isolation:

1. **www pool** (`/run/php/php8.3-fpm.sock`):
   - **Purpose**: Executes the main php-editor application
   - **Security Level**: Standard web application security
   - **Configuration**: `/etc/php/8.3/fpm/pool.d/www.conf`

2. **www_userphp pool** (`/run/php/php8.3-fpm_userphp.sock`):
   - **Purpose**: Executes user-created PHP programs
   - **Security Level**: Restrictive security settings
   - **Configuration**: `/etc/php/8.3/fpm/pool.d/www_userphp.conf`
   - **Restrictions**: Disabled dangerous functions, restricted file operations

**Why Separate Pools?**
The dual-pool architecture prevents user code from compromising the main application by applying stricter security settings to user programs while maintaining full functionality for the editor itself.

#### User PHP Pool Configuration
Separate pool for user programs:

```ini
; Start a new pool named 'www_userphp' for user programs
[www_userphp]

; Unix user/group of processes
user = www-data
group = www-data

; The address on which to accept FastCGI requests
listen = /run/php/php8.3-fpm_userphp.sock

; Set permissions for unix socket
listen.owner = www-data
listen.group = www-data

; Process manager configuration
pm = dynamic
pm.max_children = 20
pm.start_servers = 2
pm.min_spare_servers = 1
pm.max_spare_servers = 5

; Additional security for user programs
php_admin_value[disable_functions] = exec,passthru,shell_exec,system,proc_open,popen
php_admin_flag[allow_url_fopen] = off
php_admin_flag[allow_url_include] = off

; Session security settings
php_admin_flag[session.cookie_httponly] = on
```

This separate pool provides:
- **Isolation**: User code runs in a separate process pool
- **Security**: Disabled dangerous functions for user programs
- **Resource Limits**: Lower process limits for user programs
- **Monitoring**: Separate logging and monitoring for user code execution
- **Session Security**: HTTP-only cookies prevent JavaScript access to PHP sessions

#### Composer Configuration for User Programs
The system supports Composer dependencies for user programs:

**Composer Root Directory**: `/var/www/html/user-programs/.composer/`

**Setup Composer for User Programs**:
```bash
# Create composer directory
sudo mkdir -p /var/www/html/user-programs/.composer
sudo chown www-data:www-data /var/www/html/user-programs/.composer

# Navigate to composer root and install packages
cd /var/www/html/user-programs/.composer
sudo -u www-data composer install
```

**Autoloading Configuration**:
Composer autoloading is configured in two locations:
1. **PHP-FPM Pool** (`/etc/php/8.3/fpm/pool.d/www_userphp.conf`):
   ```ini
   php_admin_value[auto_prepend_file] = /var/www/html/user-programs/.composer/vendor/autoload.php
   ```

2. **User Programs PHP.ini** (`/var/www/html/user-programs/php.ini`):
   ```ini
   auto_prepend_file = /var/www/html/user-programs/.composer/vendor/autoload.php
   ```

#### Testing New PHP Functions
When adding new PHP functionality, follow this testing procedure:

**1. User Experience Testing**:
   - **Execution Test**: Use the "Run" button to test if code executes on a separate page
   - **Syntax Check Test**: Use the "Error Check" button to verify syntax validation works

**2. Troubleshooting Failed Tests**:

   **If Execution Button Fails**:
   1. Check PHP-FPM pool configuration: `/etc/php/8.3/fpm/pool.d/www_userphp.conf`
   2. Verify the function is not in `php_admin_value[disable_functions]`
   3. Restart PHP-FPM: `sudo systemctl restart php8.3-fpm`

   **If Error Check Button Fails**:
   1. Check user programs PHP configuration: `/var/www/html/user-programs/php.ini`
   2. Verify the function is not in `disable_functions`
   3. Restart PHP-FPM: `sudo systemctl restart php8.3-fpm`

#### Complete Setup Commands
```bash
# Copy all configuration files
sudo cp server_config/nginx-conf /etc/nginx/sites-available/php-editor
sudo cp server_config/fpm/php-fmp.conf /etc/php/8.3/fpm/php-fpm.conf
sudo cp server_config/fpm/pool.d/www.conf /etc/php/8.3/fpm/pool.d/www.conf
sudo cp server_config/fpm/pool.d/www_userphp.conf /etc/php/8.3/fpm/pool.d/www_userphp.conf

# Enable nginx site
sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/

# Test configurations
sudo nginx -t
sudo php-fpm8.3 -t

# Restart services
sudo systemctl restart nginx
sudo systemctl restart php8.3-fpm
```

#### Key Configuration Features

- **Cache Control for Development**: Complete cache disabling for `/user-programs/` directory to support iterative development
- **Security Headers**: X-Frame-Options, X-XSS-Protection, X-Content-Type-Options for enhanced security
- **File Upload**: Configured for up to 50MB file uploads
- **User Programs**: Special handling for `/user-programs/` directory with:
  - Complete cache disabling for dynamic content (prevents browser and CDN caching)
  - CORS headers for cross-origin requests (configurable)
  - Separate PHP processing with extended timeouts
  - Blocking of dangerous file types (.sh, .exe, etc.)
- **Static File Caching**: Optimized caching for CSS, JS, images with 1-month expiry
- **Gzip Compression**: Enabled for text-based files to improve performance
- **Security Blocks**: Hidden files, markdown files, config files, and backup files are blocked
- **Logging**: Separate access and error logs for monitoring

**Cache Control Details**:
The `/user-programs/` directory uses aggressive cache prevention:
```nginx
# Cache control 
add_header Cache-control "no-store";
add_header Pragma "no-cache";
```
This configuration:
- Prevents browser caching of user programs during development
- Bypasses CDN caching (including Cloudflare)
- Ensures immediate reflection of code changes during testing

#### Installation Steps
1. **Create the configuration file**:
   ```bash
   sudo nano /etc/nginx/sites-available/php-editor
   ```

2. **Copy the complete configuration** (shown in the Complete Setup Commands section) and customize:
   - Replace `https://example.com` with your actual domain in CORS headers
   - Update `/var/www/html/php-editor` to your installation path
   - Adjust CORS settings if needed

3. **Enable the site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/php-editor /etc/nginx/sites-enabled/
   ```

4. **Create user programs configuration** (see Complete Setup Commands section for full configuration)

5. **Test and reload nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

#### PHP-FPM Configuration
Ensure PHP-FPM is properly configured:

```bash
# Check PHP-FPM status
sudo systemctl status php8.3-fpm

# Edit PHP-FMP pool configuration if needed
sudo nano /etc/php/8.3/fpm/pool.d/www.conf
```

Key PHP-FPM settings to verify:
- `listen = /run/php/php8.3-fmp.sock`
- `user = www-data`
- `group = www-data`
- `pm.max_requests = 500` (adjust based on your needs)

#### Directory Structure and Permissions
Ensure your server directory structure and permissions are correctly set:

```bash
# Create the main directory
sudo mkdir -p /var/www/html/php-editor

# Set ownership
sudo chown -R www-data:www-data /var/www/html/php-editor

# Set base permissions
sudo find /var/www/html/php-editor -type d -exec chmod 755 {} \;
sudo find /var/www/html/php-editor -type f -exec chmod 644 {} \;

# Make PHP files executable
sudo find /var/www/html/php-editor -name "*.php" -exec chmod 644 {} \;

# Set special permissions for user-programs directory
sudo mkdir -p /var/www/html/php-editor/user-programs
sudo chmod 755 /var/www/html/php-editor/user-programs
sudo chown www-data:www-data /var/www/html/php-editor/user-programs
```

Required directory structure:
```
/var/www/html/php-editor/          # Main application (755)
├── api/                          # API endpoints (755)
│   ├── ai.php                    # AI chat API (644)
│   ├── ai_config.php             # AI configuration (600) - restricted
│   └── file_manager.php          # File management API (644)
├── user-programs/                # User code execution area (755)
├── js/                          # JavaScript files (755)
├── css/                         # Stylesheets (755)
├── templates/                   # HTML templates (755)
├── MEditor/                     # Custom editor component (755)
├── index.php                    # Main entry point (644)
└── login.php                    # Login page (644)
```

**Important**: Set restrictive permissions on sensitive files:
```bash
# Protect AI configuration file
sudo chmod 600 /var/www/html/php-editor/api/ai_config.php
sudo chown www-data:www-data /var/www/html/php-editor/api/ai_config.php
```

### Alternative: PHP Built-in Server (Development Only)
For development purposes, you can use PHP's built-in server:
```bash
cd /path/to/php-editor
php -S localhost:8000
```

**Note**: The built-in server is not recommended for production use.

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
- `server_config/`: Complete server configuration files
  - `nginx-conf`: Production nginx virtual host configuration
  - `fpm/php-fpm.conf`: PHP-FPM main configuration
  - `fpm/pool.d/www.conf`: Default PHP-FPM pool for main application
  - `fpm/pool.d/www_userphp.conf`: Separate PHP-FPM pool for user programs with security restrictions
  - `fpm/php.ini`: PHP configuration with optimized settings
- `server_config/`: Server configuration files
  - `nginx-conf`: Complete nginx virtual host configuration
  - `fpm/php-fpm.conf`: PHP-FPM main configuration
  - `fpm/pool.d/www.conf`: Default PHP-FPM pool
  - `fpm/pool.d/www_userphp.conf`: Separate pool for user code execution
  - `fpm/php.ini`: PHP configuration with security settings

## Security Best Practices
- Never commit API keys to version control
- Use the provided configuration file structure to keep sensitive data separate
- The `ai_config.php` file is automatically excluded from Git tracking
- Regularly rotate your API keys for better security

### Critical Security Settings

#### Session Security
**session.cookie_httponly**: Must be enabled to prevent JavaScript access to PHP session cookies.
- **Configuration Location**: `/etc/php/8.3/fpm/php.ini`
- **Setting**: `session.cookie_httponly = On`
- **Purpose**: Prevents session hijacking through user programs by blocking JavaScript access to session cookies
- **Risk**: Without this setting, user programs could potentially steal session tokens

#### Function Restrictions
User programs have restricted access to dangerous PHP functions:
- **Disabled Functions**: `exec`, `passthru`, `shell_exec`, `system`, `proc_open`, `popen`
- **File Operations**: `allow_url_fopen` and `allow_url_include` disabled
- **Purpose**: Prevents user code from executing system commands or accessing external resources

#### Directory Isolation
- Main application runs under standard `www` pool
- User programs execute in restricted `www_userphp` pool
- Separate autoload configuration prevents dependency conflicts

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

### PHP Function Testing Issues
When new PHP functions don't work properly:

#### Execution Button Not Working
1. **Check PHP-FPM pool configuration**:
   ```bash
   sudo nano /etc/php/8.3/fpm/pool.d/www_userphp.conf
   ```
2. **Verify function is not in disabled functions list**:
   - Look for `php_admin_value[disable_functions]`
   - Remove the function if it's listed there
3. **Restart PHP-FPM**:
   ```bash
   sudo systemctl restart php8.3-fpm
   ```

#### Error Check Button Not Working
1. **Check user programs PHP configuration**:
   ```bash
   sudo nano /var/www/html/user-programs/php.ini
   ```
2. **Verify function is not in disabled functions list**:
   - Look for `disable_functions`
   - Remove the function if it's listed there
3. **Restart PHP-FPM**:
   ```bash
   sudo systemctl restart php8.3-fpm
   ```

### Composer Issues
- **Autoload not working**: Verify autoload paths in both PHP-FPM pool config and user-programs php.ini
- **Permission errors**: Ensure www-data owns the `.composer` directory
- **Package installation fails**: Run composer commands as www-data user

### Server Configuration Issues
- **504 Gateway Timeout**: 
  - Check if PHP-FPM is running: `sudo systemctl status php8.3-fpm`
  - Increase FastCGI timeouts in nginx configuration
  - Check PHP-FPM pool configuration for process limits

- **403 Forbidden**: 
  - Verify directory permissions: `ls -la /var/www/html/php-editor`
  - Check nginx user has read access: `sudo -u www-data ls /var/www/html/php-editor`
  - Ensure index files exist and are readable

- **PHP files downloading instead of executing**: 
  - Verify PHP-FPM socket path: `/run/php/php8.3-fpm.sock`
  - Check if php8.3-fpm service is running
  - Test nginx configuration: `sudo nginx -t`

- **File upload failures**: 
  - Check directory permissions on user-programs: `ls -la /var/www/html/php-editor/user-programs`
  - Verify nginx `client_max_body_size` setting
  - Check PHP upload settings: `upload_max_filesize` and `post_max_size`

- **CORS errors in user programs**: 
  - Adjust Access-Control-Allow-Origin header in nginx config
  - For production, replace `*` with specific domains
  - Check browser developer tools for specific CORS error messages

- **Static files not loading**: 
  - Verify file permissions: `sudo find /var/www/html/php-editor -name "*.css" -o -name "*.js" | xargs ls -la`
  - Check nginx error log: `sudo tail -f /var/log/nginx/php-editor.error.log`
  - Ensure gzip module is enabled in nginx

**Debugging Commands**:
```bash
# Check nginx configuration
sudo nginx -t

# View nginx error logs
sudo tail -f /var/log/nginx/php-editor.error.log

# Check PHP-FPM status and logs
sudo systemctl status php8.3-fpm
sudo tail -f /var/log/php8.3-fpm.log

# Test file permissions
sudo -u www-data test -r /var/www/html/php-editor/index.php && echo "Readable" || echo "Not readable"

# Check socket availability
ls -la /run/php/php8.3-fpm.sock
```

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
- ✅ Added nginx configuration guidelines for production deployment

## Contributing
1. Fork the repository
2. Create a feature branch
3. Ensure API keys are properly configured using the sample template
4. Test AI functionality before submitting changes
5. Submit a pull request with detailed description of changes

## License
This project is designed for educational purposes in programming education.
