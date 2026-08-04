/**
 * GNCP Registrar Portal — RegistrarApiService Module
 *
 * Backend API abstraction layer for all Registrar operations.
 */
(function (global) {
    function createResponse(success, data = null, error = null, meta = {}) {
        return { success, data, error, meta, timestamp: new Date().toISOString() };
    }

    const RegistrarApiService = {
        async fetchAllData() {
            try {
                const response = await fetch('backend/api.php?action=fetch_all_data');
                return await response.json();
            } catch (err) {
                console.error('Failed to fetch initial registrar data:', err);
                return createResponse(false, null, 'Failed to fetch registrar database.');
            }
        },

        // Programs CRUD
        async saveProgram(programData) {
            try {
                const response = await fetch('backend/api.php?action=save_program', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ program: programData })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to save program:', err);
                return createResponse(false, null, 'Failed to save program details.');
            }
        },

        async deleteProgram(programId) {
            try {
                const response = await fetch('backend/api.php?action=delete_program', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: programId })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to delete program:', err);
                return createResponse(false, null, 'Failed to delete program.');
            }
        },

        // Subjects CRUD
        async saveSubject(subjectData) {
            try {
                const response = await fetch('backend/api.php?action=save_subject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject: subjectData })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to save subject:', err);
                return createResponse(false, null, 'Failed to save subject details.');
            }
        },

        async deleteSubject(subjectId) {
            try {
                const response = await fetch('backend/api.php?action=delete_subject', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: subjectId })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to delete subject:', err);
                return createResponse(false, null, 'Failed to delete subject.');
            }
        },

        // Curriculum CRUD
        async saveCurriculum(curriculumData) {
            try {
                const response = await fetch('backend/api.php?action=save_curriculum', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ curriculum: curriculumData })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to save curriculum:', err);
                return createResponse(false, null, 'Failed to save curriculum details.');
            }
        },

        async deleteCurriculum(curriculumId) {
            try {
                const response = await fetch('backend/api.php?action=delete_curriculum', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: curriculumId })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to delete curriculum:', err);
                return createResponse(false, null, 'Failed to delete curriculum.');
            }
        },

        // Academic Periods CRUD
        async saveAcademicPeriod(periodData) {
            try {
                const response = await fetch('backend/api.php?action=save_academic_period', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ period: periodData })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to save academic period:', err);
                return createResponse(false, null, 'Failed to save academic period details.');
            }
        },

        async deleteAcademicPeriod(periodId) {
            try {
                const response = await fetch('backend/api.php?action=delete_academic_period', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: periodId })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to delete academic period:', err);
                return createResponse(false, null, 'Failed to delete academic period.');
            }
        },

        // Subject Sections CRUD
        async saveSubjectSection(sectionData) {
            try {
                const response = await fetch('backend/api.php?action=save_subject_section', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section: sectionData })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to save subject section:', err);
                return createResponse(false, null, 'Failed to save section details.');
            }
        },

        async deleteSubjectSection(sectionId) {
            try {
                const response = await fetch('backend/api.php?action=delete_subject_section', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: sectionId })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to delete subject section:', err);
                return createResponse(false, null, 'Failed to delete section.');
            }
        },

        // Fee Schedule CRUD
        async saveFee(feeData) {
            try {
                const response = await fetch('backend/api.php?action=save_fee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fee: feeData })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to save fee schedule:', err);
                return createResponse(false, null, 'Failed to save fee details.');
            }
        },

        async deleteFee(feeId) {
            try {
                const response = await fetch('backend/api.php?action=delete_fee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: feeId })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to delete fee schedule:', err);
                return createResponse(false, null, 'Failed to delete fee.');
            }
        },

        // Legacy / details / approvals
        async updateApplicationStatus(referenceNumber, status, notes, requirementsData = null, sectionCode = null) {
            try {
                const response = await fetch('backend/api.php?action=update_application_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ referenceNumber, status, registrarNotes: notes, requirementsData, sectionCode })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to update application status:', err);
                return createResponse(false, null, 'Failed to submit review decisions.');
            }
        },

        async getSectionsForProgram(program, yearLevel, semester) {
            try {
                const response = await fetch(`backend/api.php?action=get_sections_for_program&program=${encodeURIComponent(program)}&year_level=${encodeURIComponent(yearLevel)}&semester=${encodeURIComponent(semester)}`);
                return await response.json();
            } catch (err) {
                console.error('Failed to fetch sections for program:', err);
                return createResponse(false, null, 'Failed to load sections for this program.');
            }
        },

        async updateRoadmapStep(referenceNumber, stepId, status) {
            try {
                const response = await fetch('backend/api.php?action=update_roadmap_step', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ referenceNumber, stepId, status })
                });
                return await response.json();
            } catch (err) {
                console.error('Failed to update roadmap step:', err);
                return createResponse(false, null, 'Failed to update roadmap step.');
            }
        },

        async checkSession() {
            try {
                const response = await fetch('../api/index.php?action=auth/check');
                return await response.json();
            } catch (err) {
                console.error('Failed to verify backend session:', err);
                return createResponse(false, null, 'Failed to verify backend session.');
            }
        },

        async fetchUserProfile(username) {
            try {
                const response = await fetch(`../api/index.php?action=auth/profile&username=${encodeURIComponent(username || '')}`);
                return await response.json();
            } catch (err) {
                console.error('Failed to fetch user profile:', err);
                return createResponse(false, null, 'Failed to fetch user profile.');
            }
        }
    };

    global.RegistrarApiService = RegistrarApiService;
})(typeof window !== 'undefined' ? window : this);
