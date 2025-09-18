// Smart PaperTags NFC App - Frontend JavaScript

class PaperTagsApp {
    constructor() {
        this.apiBase = '/api';
        this.currentUser = null;
        this.currentSection = 'dashboard';
        this.editingTagId = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Auth form tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchAuthTab(e.target.dataset.tab));
        });

        // Auth forms
        document.getElementById('loginFormElement').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerFormElement').addEventListener('submit', (e) => this.handleRegister(e));

        // Dashboard
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Modals
        document.getElementById('closeModal').addEventListener('click', () => this.hideTagModal());
        document.getElementById('cancelTag').addEventListener('click', () => this.hideTagModal());
        document.getElementById('tagForm').addEventListener('submit', (e) => this.handleTagSubmit(e));

        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSection(e.target.dataset.section));
        });

        // Scan functionality
        document.getElementById('scanBtn').addEventListener('click', () => this.handleScan());
    }

    // Authentication Methods
    async checkAuthStatus() {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await this.apiCall('/my-tags', 'GET', null, token);
                this.currentUser = JSON.parse(localStorage.getItem('user'));
                this.showDashboard();
            } catch (error) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                this.showAuth();
            }
        } else {
            this.showAuth();
        }
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        document.getElementById(`${tab}Form`).classList.add('active');
    }

    async handleLogin(e) {
        e.preventDefault();
        this.showLoading(true);

        try {
            const formData = new FormData(e.target);
            const data = {
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            };

            const response = await this.apiCall('/login', 'POST', data);
            
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            this.currentUser = response.user;
            
            this.showToast('Login successful!', 'success');
            this.showDashboard();
        } catch (error) {
            this.showToast(error.message || 'Login failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        this.showLoading(true);

        try {
            const data = {
                name: document.getElementById('registerName').value,
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value,
                phone: document.getElementById('registerPhone').value
            };

            const response = await this.apiCall('/register', 'POST', data);
            
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            this.currentUser = response.user;
            
            this.showToast('Registration successful!', 'success');
            this.showDashboard();
        } catch (error) {
            this.showToast(error.message || 'Registration failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUser = null;
        this.showAuth();
        this.showToast('Logged out successfully', 'success');
    }

    // UI Navigation Methods
    showAuth() {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('scanSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';
        document.getElementById('scanSection').style.display = 'none';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userName').textContent = this.currentUser.name;
        
        this.currentSection = 'dashboard';
        this.updateNavigation();
        this.loadUserTags();
    }

    showScanSection() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('scanSection').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userName').textContent = this.currentUser.name;
        
        this.currentSection = 'scan';
        this.updateNavigation();
    }

    switchSection(section) {
        if (section === 'dashboard') {
            this.showDashboard();
        } else if (section === 'scan') {
            this.showScanSection();
        }
    }

    updateNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.section === this.currentSection) {
                btn.classList.add('active');
            }
        });
    }

    // Tag Management Methods
    async loadUserTags() {
        try {
            const response = await this.apiCall('/my-tags', 'GET', null, localStorage.getItem('token'));
            this.displayTags(response.tags);
        } catch (error) {
            this.showToast('Failed to load tags', 'error');
        }
    }

    displayTags(tags) {
        const tagsList = document.getElementById('tagsList');
        
        if (tags.length === 0) {
            tagsList.innerHTML = `
                <div class="text-center" style="grid-column: 1 / -1; padding: 2rem;">
                    <i class="fas fa-tag" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <h3 style="color: #666; margin-bottom: 1rem;">No tags registered yet</h3>
                    <p style="color: #999;">Add your first PaperTag to get started!</p>
                </div>
            `;
            return;
        }

        tagsList.innerHTML = tags.map(tag => `
            <div class="tag-card">
                <div class="tag-header">
                    <div class="tag-name">${tag.tag_name || 'Unnamed Tag'}</div>
                    <div class="tag-id" style="font-size: 0.8rem; color: #666;">ID: ${tag.tag_id}</div>
                    <div class="tag-actions">
                        <button class="btn btn-sm btn-secondary" onclick="app.editTag('${tag.tag_id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteTag('${tag.tag_id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="tag-info">
                    <h4>${tag.contact_name}</h4>
                    <p><i class="fas fa-envelope"></i> ${tag.contact_email}</p>
                    ${tag.contact_phone ? `<p><i class="fas fa-phone"></i> ${tag.contact_phone}</p>` : ''}
                    <p class="text-muted">Claimed: ${new Date(tag.claimed_at).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
    }


    showTagModal(tagId) {
        this.editingTagId = tagId;
        const modal = document.getElementById('tagModal');
        const form = document.getElementById('tagForm');
        const title = document.getElementById('modalTitle');
        
        title.textContent = 'Edit Tag Contact Info';
        // Load tag data for editing
        this.loadTagForEdit(tagId);
        
        modal.classList.add('active');
    }

    hideTagModal() {
        document.getElementById('tagModal').classList.remove('active');
        this.editingTagId = null;
    }

    async loadTagForEdit(tagId) {
        try {
            // Get the tag from the current user's tags
            const response = await this.apiCall('/my-tags', 'GET', null, localStorage.getItem('token'));
            const tag = response.tags.find(t => t.tag_id === tagId);
            
            if (tag) {
                document.getElementById('editTagId').value = tag.tag_id;
                document.getElementById('tagName').value = tag.tag_name || '';
                document.getElementById('contactName').value = tag.contact_name;
                document.getElementById('contactEmail').value = tag.contact_email;
                document.getElementById('contactPhone').value = tag.contact_phone || '';
                document.getElementById('instagram').value = tag.instagram || '';
                document.getElementById('snapchat').value = tag.snapchat || '';
                document.getElementById('linkedin').value = tag.linkedin || '';
            } else {
                this.showToast('Tag not found', 'error');
                this.hideTagModal();
            }
        } catch (error) {
            this.showToast('Failed to load tag data', 'error');
        }
    }


    async handleTagSubmit(e) {
        e.preventDefault();
        this.showLoading(true);

        try {
            const data = {
                tagName: document.getElementById('tagName').value,
                contactName: document.getElementById('contactName').value,
                contactEmail: document.getElementById('contactEmail').value,
                contactPhone: document.getElementById('contactPhone').value,
                instagram: document.getElementById('instagram').value,
                snapchat: document.getElementById('snapchat').value,
                linkedin: document.getElementById('linkedin').value
            };

            await this.apiCall(`/tags/${this.editingTagId}`, 'PUT', data, localStorage.getItem('token'));
            this.showToast('Tag information updated successfully!', 'success');

            this.hideTagModal();
            this.loadUserTags();
        } catch (error) {
            this.showToast(error.message || 'Failed to update tag information', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    editTag(tagId) {
        this.showTagModal(tagId);
    }

    async deleteTag(tagId) {
        if (!confirm('Are you sure you want to delete this tag?')) {
            return;
        }

        try {
            await this.apiCall(`/tags/${tagId}`, 'DELETE', null, localStorage.getItem('token'));
            this.showToast('Tag deleted successfully!', 'success');
            this.loadUserTags();
        } catch (error) {
            this.showToast('Failed to delete tag', 'error');
        }
    }

    copyTagLink(hashedTagId) {
        const link = `${window.location.origin}/tag/${hashedTagId}`;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                this.showToast('Link copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopyTextToClipboard(link);
            });
        } else {
            this.fallbackCopyTextToClipboard(link);
        }
    }

    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showToast('Link copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy link', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // Scan Methods
    async handleScan() {
        const tagId = document.getElementById('scanTagId').value.trim();
        
        if (!tagId) {
            this.showToast('Please enter a Tag ID', 'error');
            return;
        }

        this.showLoading(true);

        try {
            // Get user's location
            const position = await this.getCurrentPosition();
            
            const data = {
                message: 'Item found via Smart PaperTags',
                pinLatitude: position.coords.latitude,
                pinLongitude: position.coords.longitude
            };

            const response = await this.apiCall(`/scan/${tagId}`, 'POST', data);
            this.displayScanResult(response);
        } catch (error) {
            if (error.code === 1) {
                // User denied location permission
                const response = await this.apiCall(`/scan/${tagId}`, 'POST', {
                    message: 'Item found via Smart PaperTags'
                });
                this.displayScanResult(response);
            } else {
                this.showToast(error.message || 'Failed to scan tag', 'error');
            }
        } finally {
            this.showLoading(false);
        }
    }

    displayScanResult(result) {
        const scanResult = document.getElementById('scanResult');
        scanResult.innerHTML = `
            <div class="owner-info">
                <h3><i class="fas fa-user"></i> Owner Information</h3>
                <p><strong>Name:</strong> ${result.ownerInfo.name}</p>
                <p><strong>Email:</strong> <a href="mailto:${result.ownerInfo.email}">${result.ownerInfo.email}</a></p>
                ${result.ownerInfo.phone ? `<p><strong>Phone:</strong> <a href="tel:${result.ownerInfo.phone}">${result.ownerInfo.phone}</a></p>` : ''}
                <p class="text-success"><i class="fas fa-check-circle"></i> ${result.message}</p>
                ${result.location ? `
                    <div class="map-container">
                        <p><strong>Approximate Location:</strong> ${result.location.city}, ${result.location.region}, ${result.location.country}</p>
                        <div id="map"></div>
                    </div>
                ` : ''}
            </div>
        `;
        
        scanResult.style.display = 'block';
        
        // Load map if location is available
        if (result.location && result.location.lat && result.location.lon) {
            this.loadMap(result.location.lat, result.location.lon);
        }
    }

    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by this browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }

    loadMap(lat, lng) {
        // Simple map display - in a real app, you'd use Google Maps or similar
        const mapDiv = document.getElementById('map');
        mapDiv.innerHTML = `
            <div style="background: #f8f9fa; border: 2px dashed #dee2e6; border-radius: 10px; padding: 2rem; text-align: center;">
                <i class="fas fa-map-marker-alt" style="font-size: 2rem; color: #667eea; margin-bottom: 1rem;"></i>
                <p><strong>Location:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
                <a href="https://maps.google.com/?q=${lat},${lng}" target="_blank" class="btn btn-primary btn-sm">
                    <i class="fas fa-external-link-alt"></i> View on Google Maps
                </a>
            </div>
        `;
    }

    // Utility Methods
    async apiCall(endpoint, method = 'GET', data = null, token = null) {
        const url = `${this.apiBase}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (token) {
            options.headers.Authorization = `Bearer ${token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'API request failed');
        }

        return result;
    }

    showLoading(show) {
        document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PaperTagsApp();
});

// Handle modal clicks
document.getElementById('tagModal').addEventListener('click', (e) => {
    if (e.target.id === 'tagModal') {
        app.hideTagModal();
    }
});

// Handle escape key for modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        app.hideTagModal();
    }
});
