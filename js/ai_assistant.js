// AI Assistant functions for PHP Editor

class AIAssistant {
    constructor() {
        this.isEnabled = true;
        this.isLoading = false;
        this.apiUrl = '/api/ai_assistant.php';
    }

    async callAI(action, params) {
        if (!this.isEnabled || this.isLoading) {
            return { status: 'error', error: 'AI Assistant is not available' };
        }

        this.isLoading = true;
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    ...params
                })
            });

            const data = await response.json();
            this.isLoading = false;
            return data;
        } catch (error) {
            this.isLoading = false;
            return { status: 'error', error: error.message };
        }
    }

    async getCodeSuggestion(code, cursorPosition, fileType) {
        return await this.callAI('code_suggestion', {
            code: code,
            cursor_position: cursorPosition,
            file_type: fileType
        });
    }

    async getCodeCompletion(code, currentLine, fileType) {
        return await this.callAI('code_completion', {
            code: code,
            current_line: currentLine,
            file_type: fileType
        });
    }

    async explainCode(code, selectedCode, fileType) {
        return await this.callAI('code_explanation', {
            code: code,
            selected_code: selectedCode,
            file_type: fileType
        });
    }

    async fixCode(code, errorMessage, fileType) {
        return await this.callAI('code_fix', {
            code: code,
            error_message: errorMessage,
            file_type: fileType
        });
    }

    async refactorCode(code, selectedCode, fileType) {
        return await this.callAI('code_refactor', {
            code: code,
            selected_code: selectedCode,
            file_type: fileType
        });
    }

    showLoadingIndicator() {
        // Create loading indicator if it doesn't exist
        if (!document.getElementById('ai-loading')) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'ai-loading';
            loadingDiv.innerHTML = `
                <div class="ai-loading-content">
                    <div class="ai-spinner"></div>
                    <span>AIが考え中です...</span>
                </div>
            `;
            loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 20px;
                border-radius: 8px;
                z-index: 9999;
                display: none;
            `;
            document.body.appendChild(loadingDiv);
        }
        document.getElementById('ai-loading').style.display = 'block';
    }

    hideLoadingIndicator() {
        const loadingDiv = document.getElementById('ai-loading');
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
    }

    async showAISuggestion(ace, suggestion) {
        if (!suggestion || suggestion.trim() === '') {
            return;
        }

        // Extract code from the suggestion
        const extractedCode = this.extractCodeFromResponse(suggestion);

        // Create a popup to show the suggestion
        const popup = document.createElement('div');
        popup.className = 'ai-suggestion-popup';
        popup.innerHTML = `
            <div class="ai-suggestion-header">
                <span>AI提案</span>
                <button class="ai-close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="ai-suggestion-content">
                <div class="ai-suggestion-tabs">
                    <button class="ai-tab-btn active" onclick="this.parentElement.parentElement.parentElement.querySelector('.ai-suggestion-code').style.display='block'; this.parentElement.parentElement.parentElement.querySelector('.ai-suggestion-raw').style.display='none'; this.parentElement.querySelectorAll('.ai-tab-btn').forEach(btn => btn.classList.remove('active')); this.classList.add('active');">コード</button>
                    <button class="ai-tab-btn" onclick="this.parentElement.parentElement.parentElement.querySelector('.ai-suggestion-code').style.display='none'; this.parentElement.parentElement.parentElement.querySelector('.ai-suggestion-raw').style.display='block'; this.parentElement.querySelectorAll('.ai-tab-btn').forEach(btn => btn.classList.remove('active')); this.classList.add('active');">元の回答</button>
                </div>
                <div class="ai-suggestion-code">
                    <pre><code>${this.escapeHtml(extractedCode)}</code></pre>
                </div>
                <div class="ai-suggestion-raw" style="display: none;">
                    <pre><code>${this.escapeHtml(suggestion)}</code></pre>
                </div>
            </div>
            <div class="ai-suggestion-actions">
                <button class="ai-accept-btn">採用</button>
                <button class="ai-reject-btn">却下</button>
            </div>
        `;

        popup.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 450px;
            max-height: 400px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            font-family: monospace;
        `;

        document.body.appendChild(popup);

        // Add event listeners
        popup.querySelector('.ai-accept-btn').addEventListener('click', () => {
            ace.insert(extractedCode);
            popup.remove();
        });

        popup.querySelector('.ai-reject-btn').addEventListener('click', () => {
            popup.remove();
        });

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.remove();
            }
        }, 30000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Extract code from AI response
    extractCodeFromResponse(response) {
        // Remove <think> tags and content
        let cleaned = response.replace(/<think>.*?<\/think>/gs, '');
        
        // Extract code blocks (```language ... ```)
        const codeBlockRegex = /```(?:php|javascript|html|css|sql|json)?\s*\n(.*?)\n```/gs;
        const matches = [];
        let match;
        
        while ((match = codeBlockRegex.exec(cleaned)) !== null) {
            matches.push(match[1]);
        }
        
        if (matches.length > 0) {
            return matches.join('\n\n');
        }
        
        // Extract code blocks without language specification
        const simpleCodeBlockRegex = /```\s*\n(.*?)\n```/gs;
        const simpleMatches = [];
        let simpleMatch;
        
        while ((simpleMatch = simpleCodeBlockRegex.exec(cleaned)) !== null) {
            simpleMatches.push(simpleMatch[1]);
        }
        
        if (simpleMatches.length > 0) {
            return simpleMatches.join('\n\n');
        }
        
        // If no code blocks found, clean the response
        cleaned = cleaned.trim();
        
        // Remove common AI explanation patterns
        const patterns = [
            /^.*?以下.*?コード.*?[:：]\s*/s,
            /^.*?修正.*?[:：]\s*/s,
            /^.*?リファクタリング.*?[:：]\s*/s,
            /^.*?提案.*?[:：]\s*/s,
            /^.*?補完.*?[:：]\s*/s,
        ];
        
        patterns.forEach(pattern => {
            cleaned = cleaned.replace(pattern, '');
        });
        
        return cleaned.trim();
    }

    // Add AI commands to ACE editor
    addAICommands(ace) {
        const self = this;

        // AI Code Suggestion (Ctrl+Space)
        ace.commands.addCommand({
            name: 'aiSuggestion',
            bindKey: { win: 'Ctrl-Space', mac: 'Cmd-Space' },
            exec: async function(editor) {
                if (self.isLoading) return;
                
                const code = editor.getValue();
                const cursorPosition = editor.getCursorPosition();
                const fileType = self.getFileType(editor);
                
                self.showLoadingIndicator();
                
                const result = await self.getCodeSuggestion(code, cursorPosition, fileType);
                
                self.hideLoadingIndicator();
                
                if (result.status === 'success') {
                    await self.showAISuggestion(editor, result.response);
                } else {
                    console.error('AI提案機能でエラーが発生しました:', result.error);
                }
            }
        });

        // AI Code Completion (Ctrl+Alt+Space)
        ace.commands.addCommand({
            name: 'aiCompletion',
            bindKey: { win: 'Ctrl-Alt-Space', mac: 'Cmd-Alt-Space' },
            exec: async function(editor) {
                if (self.isLoading) return;
                
                const code = editor.getValue();
                const currentLine = editor.session.getLine(editor.getCursorPosition().row);
                const fileType = self.getFileType(editor);
                
                self.showLoadingIndicator();
                
                const result = await self.getCodeCompletion(code, currentLine, fileType);
                
                self.hideLoadingIndicator();
                
                if (result.status === 'success') {
                    await self.showAISuggestion(editor, result.response);
                } else {
                    console.error('AI補完機能でエラーが発生しました:', result.error);
                }
            }
        });

        // AI Code Explanation (Ctrl+Alt+E)
        ace.commands.addCommand({
            name: 'aiExplanation',
            bindKey: { win: 'Ctrl-Alt-E', mac: 'Cmd-Alt-E' },
            exec: async function(editor) {
                if (self.isLoading) return;
                
                const code = editor.getValue();
                const selectedCode = editor.getSelectedText();
                const fileType = self.getFileType(editor);
                
                self.showLoadingIndicator();
                
                const result = await self.explainCode(code, selectedCode, fileType);
                
                self.hideLoadingIndicator();
                
                if (result.status === 'success') {
                    self.showExplanation(result.response);
                } else {
                    console.error('AI説明機能でエラーが発生しました:', result.error);
                }
            }
        });

        // AI Code Refactor (Ctrl+Alt+R)
        ace.commands.addCommand({
            name: 'aiRefactor',
            bindKey: { win: 'Ctrl-Alt-R', mac: 'Cmd-Alt-R' },
            exec: async function(editor) {
                if (self.isLoading) return;
                
                const code = editor.getValue();
                const selectedCode = editor.getSelectedText();
                const fileType = self.getFileType(editor);
                
                self.showLoadingIndicator();
                
                const result = await self.refactorCode(code, selectedCode, fileType);
                
                self.hideLoadingIndicator();
                
                if (result.status === 'success') {
                    await self.showAISuggestion(editor, result.response);
                } else {
                    console.error('AIリファクタリング機能でエラーが発生しました:', result.error);
                }
            }
        });
    }

    getFileType(editor) {
        const mode = editor.session.getMode().$id;
        return mode.replace('ace/mode/', '');
    }

    showExplanation(explanation) {
        const popup = document.createElement('div');
        popup.className = 'ai-explanation-popup';
        popup.innerHTML = `
            <div class="ai-explanation-header">
                <span>AIコード説明</span>
                <button class="ai-close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="ai-explanation-content">
                <p>${this.escapeHtml(explanation)}</p>
            </div>
        `;

        popup.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 500px;
            max-height: 400px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 1000;
            overflow-y: auto;
        `;

        document.body.appendChild(popup);

        // Auto-remove after 60 seconds
        setTimeout(() => {
            if (popup.parentElement) {
                popup.remove();
            }
        }, 60000);
    }
}

// Global AI Assistant instance
const aiAssistant = new AIAssistant();
