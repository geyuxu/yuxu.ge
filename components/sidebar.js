// Shared sidebar component
// Usage: <div id="sidebar-placeholder"></div> + <script src="/components/sidebar.js"></script>

const sidebarHTML = `
<div class="sidebar-top">
    <a href="/" class="avatar"><img src="/photo.jpg" alt="Yuxu Ge"></a>
    <div class="name-block"><h1>Yuxu Ge</h1></div>
    <div class="title-role">Senior AI Architect</div>
    <div class="contact-block">
        <div class="social-links">
            <a href="mailto:me@yuxu.ge">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z"/>
                    <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z"/>
                </svg>
                me@yuxu.ge
            </a>
            <a href="https://www.linkedin.com/in/geyuxu" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452H17.2v-5.569c0-1.328-.025-3.039-1.852-3.039-1.853 0-2.136 1.447-2.136 2.942v5.666h-3.248V9h3.122v1.561h.045c.435-.823 1.498-1.688 3.083-1.688 3.295 0 3.903 2.17 3.903 4.989v6.59zM5.337 7.433a1.882 1.882 0 110-3.764 1.882 1.882 0 010 3.764zm1.626 13.019H3.708V9h3.255v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.271V1.729C24 .774 23.2 0 22.222 0z"/>
                </svg>
                Linkedin
            </a>
            <a href="https://github.com/geyuxu" target="_blank" rel="noopener">
                <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                Github
            </a>
            <a href="https://x.com/YuxuGe_AI" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                @YuxuGe_AI
            </a>
            <a href="https://orcid.org/0009-0008-2990-4886" target="_blank" rel="noopener" class="orcid-link">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zM7.369 4.378c.525 0 .947.431.947.947s-.422.947-.947.947a.95.95 0 0 1-.947-.947c0-.525.422-.947.947-.947zm-.722 3.038h1.444v10.041H6.647V7.416zm3.562 0h3.9c3.712 0 5.344 2.653 5.344 5.025 0 2.578-2.016 5.025-5.325 5.025h-3.919V7.416zm1.444 1.303v7.444h2.297c3.272 0 4.022-2.484 4.022-3.722 0-2.016-1.284-3.722-4.097-3.722h-2.222z"/>
                </svg>
                0009-0008-2990-4886
            </a>
            <a href="https://medium.com/@ngzerone" target="_blank" rel="noopener">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                </svg>
                Medium
            </a>
            <a href="/blog/" class="blog-link">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                </svg>
                Blog
            </a>
        </div>
    </div>
</div>
<div class="sidebar-footer">&copy; 2026 Yuxu Ge</div>
`;

// Auto-inject if placeholder exists
document.addEventListener('DOMContentLoaded', () => {
    const placeholder = document.getElementById('sidebar-content');
    if (placeholder) {
        placeholder.innerHTML = sidebarHTML;
    }
});
