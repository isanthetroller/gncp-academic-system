/**
 * GNCP Academic Portal — Modular Station Sidebar Component v1.1
 * Unified executive dark-green & gold sidebar component for all workstations (Registrar, Helpdesk, Medical, Cashier, IT Center)
 * with robust 404 avatar error fallback to clean initials.
 */

const StationSidebar = {
    name: 'StationSidebar',
    props: {
        stationName: {
            type: String,
            default: 'GNCP Workstation'
        },
        stationTag: {
            type: String,
            default: 'OPERATOR PORTAL'
        },
        navGroups: {
            type: Array,
            default: () => []
        },
        currentView: {
            type: String,
            required: true
        },
        currentUser: {
            type: Object,
            default: () => null
        }
    },
    emits: ['set-view', 'logout'],
    data() {
        return {
            avatarFailed: false
        };
    },
    methods: {
        onAvatarError() {
            this.avatarFailed = true;
        },
        formattedAvatar(avatar) {
            if (!avatar) return null;
            if (avatar.startsWith('data:image') || avatar.startsWith('http://') || avatar.startsWith('https://')) {
                return avatar;
            }
            if (avatar.startsWith('../')) {
                return avatar;
            }
            if (avatar.startsWith('uploads/')) {
                return '../../' + avatar;
            }
            return '../../uploads/avatars/' + avatar.replace(/^\/+/, '');
        },
        formattedRole(role) {
            if (!role) return 'Station Operator';
            const r = String(role).toUpperCase();
            if (r === 'REGISTRAR') return 'Registrar Officer';
            if (r === 'HELPDESK') return 'Helpdesk Officer';
            if (r === 'MEDICAL') return 'Medical Staff';
            if (r === 'CASHIER') return 'Cashier Officer';
            if (r === 'IT_CENTER') return 'IT Center Specialist';
            if (r === 'SUPER_ADMIN') return 'Executive Admin';
            if (r === 'ADMIN') return 'System Administrator';
            return r.replace(/_/g, ' ');
        },
        displayName(user) {
            if (!user) return 'Station Operator';
            const name = user.name || user.username || 'Station Operator';
            if (name.toLowerCase() === 'go-on super admin' || name.toLowerCase() === 'super admin') {
                return 'System Administrator';
            }
            return name;
        }
    },
    template: `
        <aside class="sidebar">
            <div class="brand-block brand">
                <img src="../../school-website/assets/images/logo-removebg-preview.png" alt="GNCP Seal" class="brand-seal brand-logo" onError="this.src='../school-website/assets/images/logo-removebg-preview.png'">
                <div class="brand-text-container">
                    <h1 class="m-0 font-weight-bold" style="font-size:0.9rem; color:#fff; line-height:1.2;">{{ stationName }}</h1>
                    <span class="brand-station-tag">{{ stationTag }}</span>
                </div>
            </div>

            <nav class="nav-body sidebar-nav">
                <template v-for="(group, gIdx) in navGroups" :key="gIdx">
                    <div class="nav-cat sidebar-category-title" :style="gIdx > 0 ? 'margin-top: 8px;' : ''">{{ group.title }}</div>
                    <div v-for="item in group.items" :key="item.id" class="nav-category-wrapper">
                        <button class="nav-cat-header nav-item-top" :class="{ active: currentView === item.id }" @click="$emit('set-view', item.id)">
                            <span><i :class="'fa-solid ' + item.icon"></i> {{ item.label }}</span>
                            <span v-if="item.badge" class="badge bg-gold text-dark ms-auto" style="font-size:0.65rem; font-weight:800; padding:2px 6px;">{{ item.badge }}</span>
                        </button>
                    </div>
                </template>

                <!-- System & Account Section -->
                <div class="nav-cat sidebar-category-title" style="margin-top: 8px;">My Account</div>
                <div class="nav-category-wrapper">
                    <a href="../../shared/profile.html" class="nav-cat-header nav-item-top" style="text-decoration:none;" onError="this.href='../shared/profile.html'">
                        <span><i class="fa-solid fa-user-circle"></i> My Account Profile</span>
                        <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.65rem; opacity:0.6;"></i>
                    </a>
                </div>

                <div class="nav-category-wrapper" style="margin-top: 6px;">
                    <button class="nav-cat-header nav-item-top nav-logout" @click="$emit('logout')">
                        <span><i class="fa-solid fa-right-from-bracket"></i> Sign Out / Logout</span>
                    </button>
                </div>
            </nav>

            <a href="../../shared/profile.html" style="text-decoration:none; color:inherit;" title="View & Edit Profile">
                <div class="sidebar-footer" v-if="currentUser">
                    <div class="footer-avatar">
                        <img v-if="currentUser.avatar && !avatarFailed" :src="formattedAvatar(currentUser.avatar)" alt="" @error="onAvatarError">
                        <span v-else>{{ displayName(currentUser).substring(0,2).toUpperCase() }}</span>
                    </div>
                    <div class="footer-info">
                        <strong>{{ displayName(currentUser) }}</strong>
                        <span>{{ formattedRole(currentUser.role) }}</span>
                    </div>
                    <i class="fa-solid fa-gear" style="font-size:0.85rem; color:var(--gold, #D4AF37); opacity:0.75; transition: transform 0.2s ease;" onmouseenter="this.style.transform='rotate(45deg)'" onmouseleave="this.style.transform='rotate(0deg)'"></i>
                </div>
            </a>
        </aside>
    `
};

if (typeof window !== 'undefined') {
    window.StationSidebar = StationSidebar;
}
