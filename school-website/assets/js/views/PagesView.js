// Sub-page view components for the school website SPA
window.PagesView = {
    AboutPage: {
        props: ['subPage', 'data'],
        template: `
            <div class="subpage-wrapper">
                <!-- Page Banner Header -->
                <div class="subpage-banner text-center d-flex align-items-center justify-content-center">
                    <div class="container position-relative" style="z-index: 2;">
                        <span class="subpage-banner-tag text-gold text-uppercase fw-bold">About GNCP</span>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-if="subPage === 'about-mission'">Mission & Vision</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'about-history'">Our History</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'about-facilities'">Campus Facilities</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'about-admins'">Our Administrators</h1>
                    </div>
                </div>

                <!-- Mission & Vision Content -->
                <div v-if="subPage === 'about-mission'" class="container py-5">
                    <div class="row g-5">
                        <div class="col-md-6">
                            <div class="content-card shadow-sm border-0 h-100 p-5">
                                <div class="card-icon-header bg-green-light mb-4">
                                    <i class="fas fa-bullseye text-green fs-3"></i>
                                </div>
                                <h3 class="fw-bold text-green mb-4">OUR MISSION</h3>
                                <p class="text-muted leading-relaxed" style="font-size:1.1rem; line-height:1.8;">
                                    {{ data.mission }}
                                </p>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="content-card shadow-sm border-0 h-100 p-5">
                                <div class="card-icon-header bg-gold-light mb-4">
                                    <i class="fas fa-eye text-gold-dark fs-3"></i>
                                </div>
                                <h3 class="fw-bold text-gold-dark mb-4">OUR VISION</h3>
                                <p class="text-muted leading-relaxed" style="font-size:1.1rem; line-height:1.8;">
                                    {{ data.vision }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Core Values -->
                    <div class="mt-5 pt-4">
                        <div class="text-center mb-5">
                            <span class="section-tagline">Collegiate Ideals</span>
                            <h2 class="section-title">Our Core Values</h2>
                        </div>
                        <div class="row g-4">
                            <div v-for="val in data.values" :key="val.title" class="col-lg-4 col-md-6">
                                <div class="value-card shadow-sm h-100 text-center p-4">
                                    <div class="value-card-icon mx-auto mb-3">
                                        <i :class="val.icon"></i>
                                    </div>
                                    <h4 class="fw-bold mb-2">{{ val.title }}</h4>
                                    <p class="text-muted mb-0">{{ val.desc }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- History Content -->
                <div v-else-if="subPage === 'about-history'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">How We Started</span>
                        <h2 class="section-title">GNCP Timeline</h2>
                    </div>
                    
                    <div class="timeline-container mx-auto" style="max-width: 800px;">
                        <div v-for="(hist, idx) in data.history" :key="hist.year" 
                             class="timeline-item position-relative mb-5" 
                             :class="{ 'text-md-end': idx % 2 === 0, 'text-md-start': idx % 2 !== 0 }">
                            <div class="row align-items-center">
                                <div class="col-md-6" :class="{ 'order-md-2': idx % 2 !== 0 }">
                                    <div class="timeline-card p-4 shadow-sm">
                                        <span class="timeline-year badge bg-green px-3 py-2 mb-2" style="font-size: 1rem;">{{ hist.year }}</span>
                                        <h4 class="fw-bold mb-2">{{ hist.title }}</h4>
                                        <p class="text-muted mb-0">{{ hist.desc }}</p>
                                    </div>
                                </div>
                                <div class="col-md-6" :class="{ 'order-md-1': idx % 2 !== 0 }">
                                    <div class="timeline-image-container p-2 text-center">
                                        <img :src="hist.image" :alt="hist.title" class="img-fluid rounded shadow-sm timeline-img-styled" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Campus Facilities Content -->
                <div v-else-if="subPage === 'about-facilities'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">Learning Infrastructure</span>
                        <h2 class="section-title">Our Modern Spaces</h2>
                    </div>
                    <div class="row g-4">
                        <div v-for="fac in data.facilities" :key="fac.name" class="col-md-6">
                            <div class="facility-card shadow-sm h-100">
                                <div class="facility-img-wrapper">
                                    <img :src="fac.image" :alt="fac.name" class="facility-img">
                                </div>
                                <div class="facility-body p-4">
                                    <h4 class="fw-bold text-green mb-2">{{ fac.name }}</h4>
                                    <p class="text-muted mb-0">{{ fac.desc }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Administrators Content -->
                <div v-else-if="subPage === 'about-admins'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">College Leadership</span>
                        <h2 class="section-title">Administrative Board</h2>
                    </div>
                    <div class="row g-4 justify-content-center">
                        <div v-for="adm in data.admins" :key="adm.name" class="col-lg-3 col-md-6 col-sm-10">
                            <div class="admin-card text-center shadow-sm h-100">
                                <div class="admin-img-wrapper">
                                    <img :src="adm.image" :alt="adm.name" class="admin-img">
                                </div>
                                <div class="admin-body p-4">
                                    <h5 class="fw-bold text-green mb-1">{{ adm.name }}</h5>
                                    <p class="text-muted mb-0 small text-uppercase fw-bold">{{ adm.role }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },

    AcademicsPage: {
        props: ['subPage', 'data'],
        template: `
            <div class="subpage-wrapper">
                <!-- Page Banner Header -->
                <div class="subpage-banner text-center d-flex align-items-center justify-content-center">
                    <div class="container position-relative" style="z-index: 2;">
                        <span class="subpage-banner-tag text-gold text-uppercase fw-bold">Academic Programs</span>
                        <h1 class="subpage-banner-title text-white text-uppercase">{{ data.title }}</h1>
                    </div>
                </div>

                <div class="container py-5">
                    <div class="row g-5">
                        <div class="col-lg-8">
                            <!-- Program Profile -->
                            <div class="content-card shadow-sm p-4 mb-4 border-0">
                                <h3 class="fw-bold text-green mb-3">About the Program</h3>
                                <p class="text-muted leading-relaxed" style="font-size:1.05rem; line-height: 1.8;">
                                    {{ data.desc }}
                                </p>
                            </div>

                            <!-- Curriculum Highlights -->
                            <div class="content-card shadow-sm p-4 border-0">
                                <h3 class="fw-bold text-green mb-4">Curriculum Highlights</h3>
                                <div class="accordion border-0 shadow-none" id="curriculumAccordion">
                                    <div v-for="(year, idx) in data.curriculum" :key="year.sem" class="accordion-item mb-3 border border-light shadow-sm">
                                        <h2 class="accordion-header">
                                            <button class="accordion-button fw-bold text-dark text-uppercase bg-light" type="button" 
                                                    data-bs-toggle="collapse" :data-bs-target="'#collapse' + idx" 
                                                    :aria-expanded="idx === 0 ? 'true' : 'false'">
                                                {{ year.sem }} Subjects
                                            </button>
                                        </h2>
                                        <div :id="'collapse' + idx" class="accordion-collapse collapse" :class="{ show: idx === 0 }" data-bs-parent="#curriculumAccordion">
                                            <div class="accordion-body">
                                                <ul class="list-group list-group-flush">
                                                    <li v-for="course in year.courses" :key="course" class="list-group-item py-2">
                                                        <i class="fas fa-check text-green me-3"></i>{{ course }}
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Sidebar Info -->
                        <div class="col-lg-4">
                            <div class="sidebar-card shadow-sm bg-green text-white p-4 mb-4">
                                <h4 class="fw-bold mb-3 border-bottom border-light-subtle pb-2 text-uppercase text-gold">Career Opportunities</h4>
                                <ul class="list-unstyled">
                                    <li v-for="career in data.careers" :key="career" class="mb-3 d-flex align-items-center">
                                        <i class="fas fa-briefcase text-gold me-3"></i>
                                        <span class="fw-semibold">{{ career }}</span>
                                    </li>
                                </ul>
                            </div>

                            <div class="sidebar-card shadow-sm border border-light-subtle p-4 text-center">
                                <h4 class="fw-bold text-green mb-3">Interested in enrolling?</h4>
                                <p class="text-muted small mb-4">Undergraduate applications are currently ongoing for the first semester of A.Y. 2026-2027.</p>
                                <a :href="'../enrollment-system/index.html' + (subPage === 'acad-it' ? '?dept=COIT' : subPage === 'acad-business' ? '?dept=COBA' : subPage === 'acad-health' ? '?dept=COHS' : '')" class="btn btn-pill btn-pill-green w-100 py-3 shadow">APPLY ONLINE</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },

    AdmissionsPage: {
        props: ['subPage', 'data', 'enrollNowUrl'],
        data() {
            return {
                // Tuition Calculator States
                selectedProgram: 'it',
                yearLevel: '1',
                unitsCount: 18,
                labCourses: 1,
                paymentPlan: 'full',
                calculationResult: null
            };
        },
        methods: {
            calculateTuition() {
                const ratePerUnit = this.data.tuition.ratePerUnit;
                const baseTuition = this.unitsCount * ratePerUnit;
                
                // Calculate laboratory fees (1200 per lab course)
                const labFees = this.labCourses * 1200;
                
                // Calculate misc fees
                let miscFeesTotal = 0;
                this.data.tuition.miscFees.forEach(fee => {
                    miscFeesTotal += fee.amount;
                });
                
                // Adjust misc fee slightly if they select high lab count
                const totalGross = baseTuition + miscFeesTotal + labFees;
                
                // Applied discount (5% of base tuition for full payment)
                let discount = 0;
                if (this.paymentPlan === 'full') {
                    discount = Math.round(baseTuition * 0.05);
                }
                
                const totalDue = totalGross - discount;
                
                this.calculationResult = {
                    baseTuition,
                    miscFeesTotal,
                    labFees,
                    discount,
                    totalDue
                };
            }
        },
        template: `
            <div class="subpage-wrapper">
                <!-- Page Banner Header -->
                <div class="subpage-banner text-center d-flex align-items-center justify-content-center">
                    <div class="container position-relative" style="z-index: 2;">
                        <span class="subpage-banner-tag text-gold text-uppercase fw-bold">Admission Portal</span>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-if="subPage === 'admission-requirements'">Admission Requirements</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'admission-fees'">Tuition & Fees</h1>
                    </div>
                </div>

                <!-- Admission Requirements -->
                <div v-if="subPage === 'admission-requirements'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">How to Apply</span>
                        <h2 class="section-title">Document Checklist</h2>
                    </div>

                    <div class="row g-4">
                        <div v-for="req in data.requirements" :key="req.category" class="col-md-4">
                            <div class="content-card shadow-sm h-100 p-4 border-0">
                                <div class="bg-green-light d-inline-block px-3 py-2 rounded mb-3 text-green fw-bold text-uppercase small">
                                    {{ req.category }}
                                </div>
                                <ul class="list-group list-group-flush mt-2">
                                    <li v-for="item in req.items" :key="item" class="list-group-item py-2 px-0 bg-transparent border-light-subtle">
                                        <i class="fas fa-file-alt text-gold me-2"></i> {{ item }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="text-center mt-5 p-4 bg-light rounded shadow-sm border border-light-subtle" style="max-width: 700px; margin: 0 auto;">
                        <h4 class="fw-bold text-green mb-3">Admissions Reminder</h4>
                        <p class="text-muted mb-4">Please prepare the original copies of all documentation for physical validation at the Registrar's Office during official enrollment hours.</p>
                        <a :href="enrollNowUrl" class="btn btn-pill btn-pill-green shadow px-4">START PORTAL REGISTRATION</a>
                    </div>
                </div>

                <!-- Tuition & Fees and Calculator -->
                <div v-else-if="subPage === 'admission-fees'" class="container py-5">
                    <div class="row g-5">
                        <div class="col-lg-6">
                            <!-- Fee Table -->
                            <div class="content-card shadow-sm p-4 mb-4 border-0">
                                <h3 class="fw-bold text-green mb-3">Collegiate Fee Schedule</h3>
                                <p class="text-muted mb-4">Standard base tuition rates and mandatory miscellaneous fees for the Academic Year 2026-2027.</p>
                                
                                <div class="table-responsive">
                                    <table class="table table-bordered table-striped align-middle">
                                        <thead class="table-green text-white">
                                            <tr>
                                                <th>Fee Description</th>
                                                <th class="text-end">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td class="fw-bold">Base Tuition (per unit)</td>
                                                <td class="text-end fw-bold text-green">₱{{ data.tuition.ratePerUnit }}.00</td>
                                            </tr>
                                            <tr v-for="fee in data.tuition.miscFees" :key="fee.name">
                                                <td>{{ fee.name }}</td>
                                                <td class="text-end text-muted">₱{{ fee.amount }}.00</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Tuition Calculator -->
                        <div class="col-lg-6">
                            <div class="content-card shadow-sm p-4 border-0">
                                <div class="d-flex align-items-center mb-3">
                                    <i class="fas fa-calculator text-gold fs-3 me-3"></i>
                                    <h3 class="fw-bold text-green mb-0">Collegiate Fee Estimator</h3>
                                </div>
                                <p class="text-muted small mb-4">Get an instant itemized breakdown of your academic tuition fees.</p>

                                <form @submit.prevent="calculateTuition">
                                    <div class="row g-3 mb-4">
                                        <div class="col-md-6">
                                            <label class="form-label fw-semibold">College / Program</label>
                                            <select v-model="selectedProgram" class="form-select">
                                                <option value="it">BS Information Technology</option>
                                                <option value="business">BS Business Administration</option>
                                                <option value="education">Bachelor of Secondary Education</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label fw-semibold">Year Level</label>
                                            <select v-model="yearLevel" class="form-select">
                                                <option value="1">1st Year</option>
                                                <option value="2">2nd Year</option>
                                                <option value="3">3rd Year</option>
                                                <option value="4">4th Year</option>
                                            </select>
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label fw-semibold">Academic Units</label>
                                            <input type="number" v-model.number="unitsCount" min="3" max="26" class="form-select" />
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label fw-semibold">Laboratory Courses</label>
                                            <select v-model.number="labCourses" class="form-select">
                                                <option value="0">0 Labs</option>
                                                <option value="1">1 Lab (₱1,200)</option>
                                                <option value="2">2 Labs (₱2,400)</option>
                                                <option value="3">3 Labs (₱3,600)</option>
                                            </select>
                                        </div>
                                        <div class="col-12">
                                            <label class="form-label fw-semibold">Preferred Payment Plan</label>
                                            <div class="d-flex gap-4">
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" value="full" v-model="paymentPlan" id="planFull">
                                                    <label class="form-check-label" for="planFull">
                                                        Cash / Full Payment (5% Discount)
                                                    </label>
                                                </div>
                                                <div class="form-check">
                                                    <input class="form-check-input" type="radio" value="installment" v-model="paymentPlan" id="planInst">
                                                    <label class="form-check-label" for="planInst">
                                                        Installment Plan
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <button type="submit" class="btn btn-pill btn-pill-green w-100 py-3 shadow mb-4">CALCULATE FEES</button>
                                </form>

                                <!-- Calculations Summary -->
                                <div v-if="calculationResult" class="p-4 bg-light rounded border border-light-subtle animate-fade-in">
                                    <h5 class="fw-bold text-green mb-3 border-bottom pb-2">Fee Calculation Details</h5>
                                    
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="text-muted">Tuition Fee ({{ unitsCount }} units × ₱450):</span>
                                        <span class="fw-semibold text-dark">₱{{ calculationResult.baseTuition.toLocaleString() }}.00</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2" v-if="labCourses > 0">
                                        <span class="text-muted">Laboratory Fee ({{ labCourses }} labs × ₱1,200):</span>
                                        <span class="fw-semibold text-dark">₱{{ calculationResult.labFees.toLocaleString() }}.00</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2">
                                        <span class="text-muted">Miscellaneous Fees (Total):</span>
                                        <span class="fw-semibold text-dark">₱{{ calculationResult.miscFeesTotal.toLocaleString() }}.00</span>
                                    </div>
                                    <div class="d-flex justify-content-between mb-2 text-success" v-if="calculationResult.discount > 0">
                                        <span class="fw-semibold">Cash Discount (5% on Tuition):</span>
                                        <span class="fw-bold">- ₱{{ calculationResult.discount.toLocaleString() }}.00</span>
                                    </div>
                                    
                                    <div class="d-flex justify-content-between border-top pt-3 mt-3">
                                        <h4 class="fw-bold text-green">Estimated Total:</h4>
                                        <h4 class="fw-bold text-green">₱{{ calculationResult.totalDue.toLocaleString() }}.00</h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },

    CampusLifePage: {
        props: ['subPage', 'data'],
        template: `
            <div class="subpage-wrapper">
                <!-- Page Banner Header -->
                <div class="subpage-banner text-center d-flex align-items-center justify-content-center">
                    <div class="container position-relative" style="z-index: 2;">
                        <span class="subpage-banner-tag text-gold text-uppercase fw-bold">Campus Environment</span>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-if="subPage === 'life-council'">Student Council</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'life-athletics'">Patriots Athletics</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'life-clubs'">Clubs & Organizations</h1>
                    </div>
                </div>

                <!-- Student Council Page -->
                <div v-if="subPage === 'life-council'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">Student Voice</span>
                        <h2 class="section-title">Supreme Student Council</h2>
                        <p class="lead text-muted">{{ data.council.motto }}</p>
                    </div>

                    <div class="row g-5">
                        <!-- Projects -->
                        <div class="col-lg-6">
                            <h3 class="fw-bold text-green mb-4">Council Projects & Events</h3>
                            <div class="d-flex flex-column gap-3">
                                <div v-for="proj in data.council.projects" :key="proj.title" class="content-card shadow-sm p-4 border-0">
                                    <h5 class="fw-bold text-green mb-2">{{ proj.title }}</h5>
                                    <p class="text-muted mb-0">{{ proj.desc }}</p>
                                </div>
                            </div>
                        </div>
                        <!-- Officers -->
                        <div class="col-lg-6">
                            <h3 class="fw-bold text-green mb-4">Council Officers</h3>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped align-middle bg-white shadow-sm">
                                    <thead class="table-green text-white">
                                        <tr>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Program</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-for="off in data.council.officers" :key="off.name">
                                            <td class="fw-semibold">{{ off.name }}</td>
                                            <td class="text-gold-dark font-monospace text-uppercase small">{{ off.role }}</td>
                                            <td class="text-muted small">{{ off.program }}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Athletics Page -->
                <div v-else-if="subPage === 'life-athletics'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">Collegiate Sports</span>
                        <h2 class="section-title">Patriots Athletics</h2>
                        <p class="lead text-muted">{{ data.athletics.description }}</p>
                    </div>

                    <div class="row g-4 align-items-center">
                        <div class="col-lg-6">
                            <div class="about-collage-container">
                                <div class="dot-grid-pattern dot-grid-top-left"></div>
                                <img src="https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80" alt="Varsity Team" class="collage-img-main rounded shadow">
                            </div>
                        </div>
                        <div class="col-lg-6">
                            <h3 class="fw-bold text-green mb-4">Official Varsity Sports</h3>
                            <div class="d-flex flex-column gap-3">
                                <div v-for="sport in data.athletics.sports" :key="sport.name" class="content-card shadow-sm p-4 border-0">
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <h4 class="fw-bold text-green mb-0">{{ sport.name }}</h4>
                                        <span class="badge bg-gold-dark text-white px-3 py-2 small">{{ sport.status }}</span>
                                    </div>
                                    <p class="text-muted mb-0 small"><i class="fas fa-user-friends me-2"></i>{{ sport.coach }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Clubs Page -->
                <div v-else-if="subPage === 'life-clubs'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">Student Activity</span>
                        <h2 class="section-title">Campus Clubs</h2>
                    </div>

                    <div class="row g-4">
                        <div v-for="club in data.clubs" :key="club.name" class="col-md-6">
                            <div class="content-card shadow-sm h-100 p-4 border-0">
                                <div class="card-icon-header bg-green-light mb-3">
                                    <i class="fas fa-users text-green fs-4"></i>
                                </div>
                                <h4 class="fw-bold text-green mb-2">{{ club.name }}</h4>
                                <p class="text-muted mb-0 leading-relaxed">{{ club.desc }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    },

    PaymentsPage: {
        props: ['subPage', 'data'],
        template: `
            <div class="subpage-wrapper">
                <!-- Page Banner Header -->
                <div class="subpage-banner text-center d-flex align-items-center justify-content-center">
                    <div class="container position-relative" style="z-index: 2;">
                        <span class="subpage-banner-tag text-gold text-uppercase fw-bold">Payments</span>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-if="subPage === 'payments-portals'">Payment Portals</h1>
                        <h1 class="subpage-banner-title text-white text-uppercase" v-else-if="subPage === 'payments-terms'">Payment Terms</h1>
                    </div>
                </div>

                <!-- Payment Portals Page -->
                <div v-if="subPage === 'payments-portals'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">Tuition Remittance</span>
                        <h2 class="section-title">Official Payment Portals</h2>
                    </div>

                    <div class="row g-4">
                        <div v-for="portal in data.portals" :key="portal.name" class="col-md-4">
                            <div class="content-card shadow-sm h-100 p-4 border-0">
                                <div class="card-icon-header bg-gold-light mb-3">
                                    <i class="fas fa-credit-card text-gold-dark fs-4"></i>
                                </div>
                                <h4 class="fw-bold text-green mb-3">{{ portal.name }}</h4>
                                <ul class="list-group list-group-flush bg-transparent">
                                    <li v-for="channel in portal.channels" :key="channel" class="list-group-item bg-transparent px-0 border-light-subtle">
                                        <i class="fas fa-chevron-right text-gold me-2"></i> {{ channel }}
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Payment Terms Page -->
                <div v-else-if="subPage === 'payments-terms'" class="container py-5">
                    <div class="text-center mb-5">
                        <span class="section-tagline">Financial Schedule</span>
                        <h2 class="section-title">Collegiate Payment Terms</h2>
                    </div>

                    <div class="row g-4 justify-content-center">
                        <div v-for="term in data.terms" :key="term.plan" class="col-lg-4 col-md-6">
                            <div class="content-card shadow-sm h-100 p-4 border-0">
                                <h4 class="fw-bold text-green mb-3 border-bottom pb-2">{{ term.plan }}</h4>
                                <p class="text-muted leading-relaxed">{{ term.desc }}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `
    }
};
