// ctop entry point. Full orchestration lands in Task 15.
const status = document.getElementById("ctop-status");
if (window.cockpit) {
    status.textContent = "ctop loaded — cockpit bridge available";
} else {
    status.textContent = "ctop loaded — WARNING: no cockpit bridge";
}
