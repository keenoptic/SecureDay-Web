import * as Crypto from './crypto.js';

// DOM Elements
const dom = {
    tabs: {
        mode: document.querySelectorAll('.mode-tabs .tab-btn'),
        key: document.querySelectorAll('.key-tabs .key-btn'),
    },
    sections: {
        password: document.getElementById('PasswordSection'),
        file: document.getElementById('FileKeySection'),
        confirmPassword: document.getElementById('ConfirmPasswordGroup'),
        result: document.getElementById('ResultSection'),
    },
    inputs: {
        text: document.getElementById('TextInput'),
        password: document.getElementById('PasswordInput'),
        confirmPassword: document.getElementById('ConfirmPasswordInput'),
        file: document.getElementById('KeyFileInput'),
        result: document.getElementById('ResultOutput'),
    },
    labels: {
        text: document.getElementById('TextInputLabel'),
        fileName: document.getElementById('FileName'),
        fileSize: document.getElementById('FileSize'),
    },
    buttons: {
        action: document.getElementById('ActionBtn'),
        togglePassword: document.getElementById('TogglePasswordBtn'),
        copy: document.getElementById('CopyBtn'),
        download: document.getElementById('DownloadBtn'),
        clear: document.getElementById('ClearBtn'),
    },
    notification: document.getElementById('NotificationArea'),
};

// State
let state = {
    mode: 'encrypt', // 'encrypt' | 'decrypt'
    keyType: 'password', // 'password' | 'file'
    selectedFile: null,
};

// Initialization
function init() {
    setupEventListeners();
    updateUI();
}

function setupEventListeners() {
    // Mode Tabs
    dom.tabs.mode.forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.mode === btn.dataset.tab) return;
            state.mode = btn.dataset.tab;
            clearInputs(false); // Clear everything
            updateUI();
        });
    });

    // Key Type Tabs
    dom.tabs.key.forEach(btn => {
        btn.addEventListener('click', () => {
            if (state.keyType === btn.dataset.key) return;
            state.keyType = btn.dataset.key;
            clearInputs(false); // Clear everything
            updateUI();
        });
    });

    // File Input
    dom.inputs.file.addEventListener('change', handleFileSelect);

    // Password Toggle
    dom.buttons.togglePassword.addEventListener('click', togglePasswordVisibility);

    // Action Button (Encrypt/Decrypt)
    dom.buttons.action.addEventListener('click', handleAction);

    // Result Actions
    dom.buttons.copy.addEventListener('click', copyResult);
    dom.buttons.download.addEventListener('click', downloadResult);
    dom.buttons.clear.addEventListener('click', clearAll);

    // Global Enter key support
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // If we are in a textarea, let it handle Enter normally (new line)
            if (event.target.tagName === 'TEXTAREA') return;
            
            // Otherwise, trigger the action
            handleAction();
        }
    });
}

function updateUI() {
    // Update Mode Tabs
    dom.tabs.mode.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === state.mode);
    });

    // Update Key Tabs
    dom.tabs.key.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.key === state.keyType);
    });

    // Update Action Button Text
    dom.buttons.action.textContent = state.mode === 'encrypt' ? 'Зашифровать' : 'Расшифровать';

    // Update Inputs Visibility
    if (state.keyType === 'password') {
        dom.sections.password.classList.remove('hidden');
        dom.sections.file.classList.add('hidden');
        
        // Confirm Password only for Encrypt mode
        if (state.mode === 'encrypt') {
            dom.sections.confirmPassword.classList.remove('hidden');
        } else {
            dom.sections.confirmPassword.classList.add('hidden');
        }
    } else {
        dom.sections.password.classList.add('hidden');
        dom.sections.file.classList.remove('hidden');
    }

    // Update Labels
    dom.labels.text.textContent = state.mode === 'encrypt' 
        ? 'Текст для шифрования' 
        : 'Зашифрованное сообщение (Base64)';
    
    dom.inputs.text.placeholder = state.mode === 'encrypt'
        ? 'Введите текст...'
        : 'Вставьте зашифрованное сообщение...';

    // Clear notifications and result on mode switch
    hideNotification();
    // We don't clear inputs automatically to prevent accidental data loss, 
    // but we might hide result section if needed. 
    // For now let's keep it visible if there is content.
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        state.selectedFile = file;
        dom.labels.fileName.textContent = file.name;
        dom.labels.fileSize.textContent = `(${formatBytes(file.size)})`;
    } else {
        state.selectedFile = null;
        dom.labels.fileName.textContent = 'Файл не выбран';
        dom.labels.fileSize.textContent = '';
    }
}

function togglePasswordVisibility() {
    const type = dom.inputs.password.type === 'password' ? 'text' : 'password';
    dom.inputs.password.type = type;
    dom.inputs.confirmPassword.type = type;
    dom.buttons.togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
}

function validate() {
    const text = dom.inputs.text.value.trim();
    if (!text) {
        showError('Введите текст для обработки');
        return false;
    }

    if (state.keyType === 'password') {
        const password = dom.inputs.password.value;
        if (!password) {
            showError('Введите пароль');
            return false;
        }
        
        if (state.mode === 'encrypt') {
            const confirm = dom.inputs.confirmPassword.value;
            if (password !== confirm) {
                showError('Пароли не совпадают');
                return false;
            }
        }
    } else {
        if (!state.selectedFile) {
            showError('Выберите файл-ключ');
            return false;
        }
    }

    return true;
}

async function handleAction() {
    if (!validate()) return;

    setLoading(true);
    hideNotification();

    try {
        const text = dom.inputs.text.value.trim();
        let result = '';

        if (state.mode === 'encrypt') {
            if (state.keyType === 'password') {
                result = await Crypto.encryptWithPassword(text, dom.inputs.password.value);
            } else {
                result = await Crypto.encryptWithFile(text, state.selectedFile);
            }
            showSuccess('Текст успешно зашифрован!');
        } else {
            if (state.keyType === 'password') {
                result = await Crypto.decryptWithPassword(text, dom.inputs.password.value);
            } else {
                result = await Crypto.decryptWithFile(text, state.selectedFile);
            }
            showSuccess('Текст успешно расшифрован!');
        }

        dom.inputs.result.value = result;
        dom.sections.result.classList.remove('hidden');
        
    } catch (error) {
        showError(error.message || 'Произошла ошибка при обработке');
        console.error(error);
    } finally {
        setLoading(false);
    }
}

function copyResult() {
    const text = dom.inputs.result.value;
    if (!text) return;

    navigator.clipboard.writeText(text).then(() => {
        const originalText = dom.buttons.copy.textContent;
        dom.buttons.copy.textContent = 'Скопировано!';
        setTimeout(() => {
            dom.buttons.copy.textContent = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
        // Fallback
        dom.inputs.result.select();
        document.execCommand('copy');
    });
}

function downloadResult() {
    const text = dom.inputs.result.value;
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.mode === 'encrypt' ? 'encrypted.txt' : 'decrypted.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function clearInputs(keepPassword = false) {
    dom.inputs.text.value = '';
    
    if (!keepPassword) {
        dom.inputs.password.value = '';
    }
    
    dom.inputs.confirmPassword.value = '';
    dom.inputs.file.value = ''; // Reset file input
    dom.inputs.result.value = '';
    
    state.selectedFile = null;
    dom.labels.fileName.textContent = 'Файл не выбран';
    dom.labels.fileSize.textContent = '';
    
    dom.sections.result.classList.add('hidden');
    hideNotification();
}

function clearAll() {
    clearInputs(false);
}

// Helpers
function setLoading(isLoading) {
    dom.buttons.action.disabled = isLoading;
    dom.buttons.action.textContent = isLoading ? 'Обработка...' : (state.mode === 'encrypt' ? 'Зашифровать' : 'Расшифровать');
    document.body.style.cursor = isLoading ? 'wait' : 'default';
}

function showError(message) {
    dom.notification.innerHTML = `
        <div class="notification error">
            <span>⚠️</span>
            <span>${message}</span>
        </div>
    `;
    dom.notification.classList.remove('hidden');
}

function showSuccess(message) {
    dom.notification.innerHTML = `
        <div class="notification success">
            <span>✅</span>
            <span>${message}</span>
        </div>
    `;
    dom.notification.classList.remove('hidden');
}

function hideNotification() {
    dom.notification.innerHTML = '';
    dom.notification.classList.add('hidden');
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Start
document.addEventListener('DOMContentLoaded', init);
