/**
 * GNCP Academic Portal — Modular Station Sidebar Component (Forwarder)
 * Points directly to single-source-of-truth EmployeeSidebar component.
 */
if (typeof window !== 'undefined') {
    if (typeof EmployeeSidebar !== 'undefined') {
        window.StationSidebar = EmployeeSidebar;
    }
}
