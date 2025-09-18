// Admin Dashboard JavaScript

class AdminDashboard {
    constructor() {
        this.apiBase = '/api';
        this.currentAdmin = null;
        this.tags = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('adminLoginForm').addEventListener('submit', (e) => this.handleLogin(e));

        // Dashboard buttons
        document.getElementById('generateTagsBtn').addEventListener('click', () => this.showGenerateModal());
        document.getElementById('refreshTagsBtn').addEventListener('click', () => this.loadTags());
        document.getElementById('createAdminBtn').addEventListener('click', () => this.showCreateAdminModal());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // Modals
        document.getElementById('closeGenerateModal').addEventListener('click', () => this.hideGenerateModal());
        document.getElementById('closeCreateAdminModal').addEventListener('click', () => this.hideCreateAdminModal());
        document.getElementById('cancelGenerate').addEventListener('click', () => this.hideGenerateModal());
        document.getElementById('cancelCreateAdmin').addEventListener('click', () => this.hideCreateAdminModal());

        // Forms
        document.getElementById('generateForm').addEventListener('submit', (e) => this.handleGenerateTags(e));
        document.getElementById('createAdminForm').addEventListener('submit', (e) => this.handleCreateAdmin(e));

        // Modal clicks
        document.getElementById('generateModal').addEventListener('click', (e) => {
            if (e.target.id === 'generateModal') this.hideGenerateModal();
        });
        document.getElementById('createAdminModal').addEventListener('click', (e) => {
            if (e.target.id === 'createAdminModal') this.hideCreateAdminModal();
        });
    }

    async checkAuthStatus() {
        const token = localStorage.getItem('adminToken');
        if (token) {
            try {
                // Try to load tags to verify token
                await this.loadTags();
                this.currentAdmin = JSON.parse(localStorage.getItem('admin'));
                this.showDashboard();
            } catch (error) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('admin');
                this.showLogin();
            }
        } else {
            this.showLogin();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        this.showLoading(true);

        try {
            const data = {
                email: document.getElementById('adminEmail').value,
                password: document.getElementById('adminPassword').value
            };

            const response = await this.apiCall('/admin/login', 'POST', data);
            
            localStorage.setItem('adminToken', response.token);
            localStorage.setItem('admin', JSON.stringify(response.admin));
            this.currentAdmin = response.admin;
            
            this.showToast('Login successful!', 'success');
            this.showDashboard();
            await this.loadTags();
        } catch (error) {
            this.showToast(error.message || 'Login failed', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    logout() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('admin');
        this.currentAdmin = null;
        this.showLogin();
        this.showToast('Logged out successfully', 'success');
    }

    showLogin() {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('adminDashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('adminName').textContent = this.currentAdmin.name;
    }

    async loadTags() {
        try {
            const response = await this.apiCall('/admin/tags', 'GET', null, localStorage.getItem('adminToken'));
            this.tags = response.tags;
            this.displayTags();
            this.updateStats();
        } catch (error) {
            this.showToast('Failed to load tags', 'error');
        }
    }

    displayTags() {
        const tbody = document.getElementById('tagsTableBody');
        
        if (this.tags.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                        No tags found. Generate some tags to get started.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.tags.map(tag => {
            const claimableUrl = `${window.location.origin}/tag/${tag.hashed_tag_id}`;
            return `
                <tr>
                    <td><span class="tag-id">${tag.tag_id}</span></td>
                    <td><span class="hashed-id">${tag.hashed_tag_id}</span></td>
                    <td>
                        <span class="status-badge ${this.getStatusClass(tag)}">
                            ${this.getStatusText(tag)}
                        </span>
                    </td>
                    <td>${tag.owner_name || 'Unclaimed'}</td>
                    <td>${tag.assigned_at ? new Date(tag.assigned_at).toLocaleDateString() : 'Not assigned'}</td>
                    <td>${tag.claimed_at ? new Date(tag.claimed_at).toLocaleDateString() : 'Not claimed'}</td>
                    <td>
                        ${tag.is_assigned ? `
                            <div style="margin-bottom: 0.5rem;">
                                <div style="background: #f8f9fa; padding: 0.5rem; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 0.8rem; word-break: break-all; color: #666; margin-bottom: 0.5rem;">
                                    ${claimableUrl}
                                </div>
                                <button class="btn btn-sm btn-primary" onclick="admin.copyClaimableLink('${claimableUrl}')" style="width: 100%;">
                                    <i class="fas fa-copy"></i> Copy Link
                                </button>
                            </div>
                        ` : ''}
                    </td>
                    <td>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${!tag.is_assigned ? `
                                <button class="btn btn-sm btn-success" onclick="admin.assignTag('${tag.tag_id}')">
                                    <i class="fas fa-check"></i> Assign
                                </button>
                            ` : ''}
                            ${tag.is_assigned && !tag.is_claimed ? `
                                <button class="btn btn-sm btn-warning" onclick="admin.unassignTag('${tag.tag_id}')">
                                    <i class="fas fa-undo"></i> Unassign
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-danger" onclick="admin.deleteTag('${tag.tag_id}')" title="Delete Tag">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getStatusClass(tag) {
        if (tag.is_claimed) return 'status-claimed';
        if (tag.is_assigned) return 'status-assigned';
        return 'status-unassigned';
    }

    getStatusText(tag) {
        if (tag.is_claimed) return 'Claimed';
        if (tag.is_assigned) return 'Assigned';
        return 'Unassigned';
    }

    updateStats() {
        const total = this.tags.length;
        const assigned = this.tags.filter(tag => tag.is_assigned).length;
        const claimed = this.tags.filter(tag => tag.is_claimed).length;
        const unassigned = total - assigned;

        document.getElementById('totalTags').textContent = total;
        document.getElementById('assignedTags').textContent = assigned;
        document.getElementById('claimedTags').textContent = claimed;
        document.getElementById('unassignedTags').textContent = unassigned;
    }

    async assignTag(tagId) {
        try {
            await this.apiCall(`/admin/tags/${tagId}/assign`, 'POST', null, localStorage.getItem('adminToken'));
            this.showToast('Tag assigned successfully! Claimable link is now available.', 'success');
            await this.loadTags();
        } catch (error) {
            this.showToast('Failed to assign tag', 'error');
        }
    }

    async unassignTag(tagId) {
        if (!confirm('Are you sure you want to unassign this tag?')) {
            return;
        }

        try {
            // Note: You might want to add an unassign endpoint to the server
            this.showToast('Unassign functionality not implemented yet', 'error');
        } catch (error) {
            this.showToast('Failed to unassign tag', 'error');
        }
    }

    async deleteTag(tagId) {
        if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
            return;
        }

        try {
            await this.apiCall(`/admin/tags/${tagId}/delete`, 'DELETE', null, localStorage.getItem('adminToken'));
            this.showToast('Tag deleted successfully!', 'success');
            await this.loadTags();
        } catch (error) {
            this.showToast('Failed to delete tag', 'error');
        }
    }

    copyClaimableLink(url) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => {
                this.showToast('Claimable link copied to clipboard!', 'success');
            }).catch(() => {
                this.fallbackCopyTextToClipboard(url);
            });
        } else {
            this.fallbackCopyTextToClipboard(url);
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
            this.showToast('Claimable link copied to clipboard!', 'success');
        } catch (err) {
            this.showToast('Failed to copy link', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    showGenerateModal() {
        document.getElementById('generateModal').classList.add('active');
    }

    hideGenerateModal() {
        document.getElementById('generateModal').classList.remove('active');
        document.getElementById('generateForm').reset();
    }

    showCreateAdminModal() {
        document.getElementById('createAdminModal').classList.add('active');
    }

    hideCreateAdminModal() {
        document.getElementById('createAdminModal').classList.remove('active');
        document.getElementById('createAdminForm').reset();
    }

    async handleGenerateTags(e) {
        e.preventDefault();
        this.showLoading(true);

        try {
            const count = parseInt(document.getElementById('tagCount').value);
            const response = await this.apiCall('/admin/generate-tags', 'POST', { count }, localStorage.getItem('adminToken'));
            
            this.showToast(`${count} tags generated successfully!`, 'success');
            this.hideGenerateModal();
            await this.loadTags();
        } catch (error) {
            this.showToast('Failed to generate tags', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async handleCreateAdmin(e) {
        e.preventDefault();
        this.showLoading(true);

        try {
            const data = {
                name: document.getElementById('newAdminName').value,
                email: document.getElementById('newAdminEmail').value,
                password: document.getElementById('newAdminPassword').value
            };

            await this.apiCall('/admin/create', 'POST', data);
            
            this.showToast('Admin created successfully!', 'success');
            this.hideCreateAdminModal();
        } catch (error) {
            this.showToast('Failed to create admin', 'error');
        } finally {
            this.showLoading(false);
        }
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
        document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
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

// Initialize the admin dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminDashboard();
});

// Handle escape key for modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        admin.hideGenerateModal();
        admin.hideCreateAdminModal();
    }
});
