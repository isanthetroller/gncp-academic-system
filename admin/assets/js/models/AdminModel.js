/**
 * GNCP Super Admin — Data Model & API Service
 */

window.AdminModel = (function () {
    const API = 'backend/api.php';

    const handleFetchResponse = async (res) => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('[AdminModel] Invalid JSON response from server:', text);
            return { success: false, error: 'Server returned an invalid format. Check console logs for details.' };
        }
    };

    const get = (action) => fetch(`${API}?action=${action}`).then(handleFetchResponse);
    const post = (action, body) => fetch(`${API}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).then(handleFetchResponse);

    return {
        get,
        post,

        fetchAcademicData: () => get('fetch_academic_data'),
        fetchOperators: () => get('fetch_users'),
        updateOperatorStatus: (userId, status) => post('update_user_status', { userId, status }),
        saveUser: (user) => post('save_user', { user }),
        updateOperator: (userId, name, email, role) => post('update_operator', { userId, name, email, role }),

        saveProgram: (form) => post('save_program', { program: form }),
        deleteProgram: (id) => post('delete_program', { id }),
        saveSubject: (form) => post('save_subject', { subject: form }),
        deleteSubject: (id) => post('delete_subject', { id }),
        saveCurriculum: (form) => post('save_curriculum', { curriculum: form }),
        deleteCurriculum: (id) => post('delete_curriculum', { id }),
        cloneCurriculumVersion: (payload) => post('clone_curriculum_version', payload),
        deleteCurriculumVersion: (payload) => post('delete_curriculum_version', payload),
        savePeriod: (form) => post('save_period', { period: form }),
        deletePeriod: (id) => post('delete_period', { id }),
        saveSection: (form) => post('save_section', { section: form }),
        deleteSection: (id) => post('delete_section', { id }),
        saveClassOffering: (form) => post('save_class_offering', { offering: form }),
        deleteClassOffering: (id) => post('delete_class_offering', { id }),
        saveFee: (form) => post('save_fee', { fee: form }),
        deleteFee: (id) => post('delete_fee', { id }),
        cloneTerm: (cloneForm) => post('clone_term', cloneForm),
        bulkSections: (bulkForm) => post('bulk_sections', bulkForm),
        saveDepartment: (form) => post('save_department', { department: form }),
        deleteDepartment: (id) => post('delete_department', { id }),

        fetchAnnouncements: () => get('fetch_announcements'),
        saveAnnouncement: (form) => post('save_announcement', { announcement: form }),
        deleteAnnouncement: (id) => post('delete_announcement', { id }),
        uploadAnnouncementImage: (file) => {
            const formData = new FormData();
            formData.append('image', file);
            return fetch(`${API}?action=upload_announcement_image`, {
                method: 'POST',
                body: formData
            }).then(handleFetchResponse);
        }
    };
})();
