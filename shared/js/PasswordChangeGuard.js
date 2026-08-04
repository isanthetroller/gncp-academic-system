/**
 * GNCP Temporary Password Enforcement Guard
 * Prompts user with a mandatory, non-dismissable SweetAlert modal if must_change_password is true.
 */
(function (global) {
    const PasswordChangeGuard = {
        checkAndPrompt: function (user, onComplete) {
            if (!user || !user.must_change_password) {
                if (typeof onComplete === 'function') onComplete(false);
                return Promise.resolve(false);
            }

            return new Promise((resolve) => {
                const promptPasswordChange = () => {
                    if (typeof Swal === 'undefined') {
                        console.warn('[PasswordChangeGuard] SweetAlert2 not loaded.');
                        resolve(false);
                        return;
                    }

                    Swal.fire({
                        title: 'Mandatory Password Reset Required',
                        icon: 'warning',
                        html: `
                            <div style="text-align: left; padding: 4px 0 10px 0; font-family: 'Open Sans', sans-serif;">
                                <p style="font-size: 0.88rem; color: #475569; margin-bottom: 20px; line-height: 1.5;">
                                    Welcome, <strong>${user.name || user.username}</strong>! Because you logged in with a temporary password, you must set a new password before accessing your workstation.
                                </p>
                                
                                <div style="margin-bottom: 16px;">
                                    <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; display: block; margin-bottom: 6px;">Current / Temporary Password</label>
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <input id="swal-curr-pass" type="password" placeholder="Enter current temporary password" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 40px 10px 14px; font-size: 0.9rem; outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s;">
                                        <button type="button" class="swal-toggle-pass-btn" data-target="swal-curr-pass" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1rem; color: #64748b; outline: none; padding: 4px 6px; display: flex; align-items: center; justify-content: center;" title="Toggle Password Visibility">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                    </div>
                                </div>

                                <div style="margin-bottom: 16px;">
                                    <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; display: block; margin-bottom: 6px;">New Password (Min. 6 characters)</label>
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <input id="swal-new-pass" type="password" placeholder="Enter new password" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 40px 10px 14px; font-size: 0.9rem; outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s;">
                                        <button type="button" class="swal-toggle-pass-btn" data-target="swal-new-pass" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1rem; color: #64748b; outline: none; padding: 4px 6px; display: flex; align-items: center; justify-content: center;" title="Toggle Password Visibility">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                    </div>
                                </div>

                                <div style="margin-bottom: 4px;">
                                    <label style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #334155; display: block; margin-bottom: 6px;">Confirm New Password</label>
                                    <div style="position: relative; display: flex; align-items: center;">
                                        <input id="swal-confirm-pass" type="password" placeholder="Re-enter new password" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 10px 40px 10px 14px; font-size: 0.9rem; outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s;">
                                        <button type="button" class="swal-toggle-pass-btn" data-target="swal-confirm-pass" style="position: absolute; right: 10px; background: none; border: none; cursor: pointer; font-size: 1rem; color: #64748b; outline: none; padding: 4px 6px; display: flex; align-items: center; justify-content: center;" title="Toggle Password Visibility">
                                            <i class="fa-solid fa-eye"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `,
                        confirmButtonText: '<i class="fa-solid fa-check-circle" style="margin-right: 6px;"></i> Update Password & Continue',
                        confirmButtonColor: '#006A4E',
                        showCloseButton: true,
                        showCancelButton: true,
                        cancelButtonText: '<i class="fa-solid fa-arrow-left" style="margin-right: 5px;"></i> Cancel & Logout',
                        cancelButtonColor: '#64748b',
                        allowOutsideClick: false,
                        allowEscapeKey: true,
                        allowEnterKey: true,
                        didOpen: () => {
                            const inputs = document.querySelectorAll('#swal-curr-pass, #swal-new-pass, #swal-confirm-pass');
                            inputs.forEach(inp => {
                                inp.addEventListener('focus', () => {
                                    inp.style.borderColor = '#006A4E';
                                });
                                inp.addEventListener('blur', () => {
                                    inp.style.borderColor = '#cbd5e1';
                                });
                            });

                            const toggleBtns = document.querySelectorAll('.swal-toggle-pass-btn');
                            toggleBtns.forEach(btn => {
                                btn.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    const targetId = btn.getAttribute('data-target');
                                    const input = document.getElementById(targetId);
                                    if (input) {
                                        if (input.type === 'password') {
                                            input.type = 'text';
                                            btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                                            btn.style.color = '#006A4E';
                                        } else {
                                            input.type = 'password';
                                            btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
                                            btn.style.color = '#64748b';
                                        }
                                    }
                                });
                            });
                        },
                        preConfirm: () => {
                            const curr = document.getElementById('swal-curr-pass').value.trim();
                            const newP = document.getElementById('swal-new-pass').value.trim();
                            const confP = document.getElementById('swal-confirm-pass').value.trim();

                            if (!curr) {
                                Swal.showValidationMessage('Please enter your current temporary password.');
                                return false;
                            }
                            if (!newP || newP.length < 6) {
                                Swal.showValidationMessage('New password must be at least 6 characters.');
                                return false;
                            }
                            if (newP !== confP) {
                                Swal.showValidationMessage('New password and confirmation do not match.');
                                return false;
                            }
                            if (newP === curr) {
                                Swal.showValidationMessage('New password cannot be identical to current temporary password.');
                                return false;
                            }

                            // Compute correct relative path to api/index.php
                            let apiPath = 'api/index.php?action=auth/change_password';
                            if (window.location.pathname.includes('/stations/')) {
                                apiPath = '../../api/index.php?action=auth/change_password';
                            } else if (window.location.pathname.includes('/registrar/') || window.location.pathname.includes('/admin/')) {
                                apiPath = '../api/index.php?action=auth/change_password';
                            }

                            return fetch(apiPath, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    username: user.username,
                                    current_password: curr,
                                    new_password: newP
                                })
                            })
                            .then(res => res.json())
                            .then(data => {
                                if (!data.success) {
                                    throw new Error(data.message || data.error || 'Failed to update password.');
                                }
                                return data;
                            })
                            .catch(err => {
                                Swal.showValidationMessage(err.message || 'Error communicating with authentication server.');
                            });
                        }
                    }).then((result) => {
                        if (result.isConfirmed) {
                            // Update local session user state
                            user.must_change_password = false;
                            const sessionKey = (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') ? 'gncp_admin_user' : 'gncp_station_user';
                            sessionStorage.setItem(sessionKey, JSON.stringify(user));

                            Swal.fire({
                                title: 'Password Change Complete!',
                                text: 'Your password has been updated successfully. Proceeding to workstation...',
                                icon: 'success',
                                confirmButtonColor: '#006A4E',
                                timer: 2000,
                                timerProgressBar: true
                            }).then(() => {
                                if (typeof onComplete === 'function') onComplete(true);
                                resolve(true);
                            });
                        } else {
                            // User cancelled or closed password reset — clear session and return to login
                            sessionStorage.removeItem('gncp_admin_user');
                            sessionStorage.removeItem('gncp_station_user');

                            let loginPath = 'index.html';
                            if (window.location.pathname.includes('/stations/')) {
                                loginPath = '../../index.html';
                            } else if (window.location.pathname.includes('/registrar/') || window.location.pathname.includes('/admin/')) {
                                loginPath = '../index.html';
                            }
                            window.location.href = loginPath;
                            resolve(false);
                        }
                    });
                };

                promptPasswordChange();
            });
        }
    };

    global.PasswordChangeGuard = PasswordChangeGuard;
})(typeof window !== 'undefined' ? window : this);
