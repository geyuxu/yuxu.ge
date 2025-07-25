document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('pre').forEach((pre) => {
        const code = pre.querySelector('code');
        if (!code) {
            return;
        }

        const button = document.createElement('button');
        button.innerText = 'Copy';
        button.classList.add('copy-code-button');
        
        pre.style.position = 'relative';
        button.style.position = 'absolute';
        button.style.top = '0.5em';
        button.style.right = '0.5em';
        button.style.padding = '0.25em 0.5em';
        button.style.border = '1px solid #ccc';
        button.style.borderRadius = '4px';
        button.style.backgroundColor = '#f0f0f0';
        button.style.cursor = 'pointer';


        button.addEventListener('click', () => {
            const text = code.innerText;
            navigator.clipboard.writeText(text).then(() => {
                button.innerText = 'Copied!';
                setTimeout(() => {
                    button.innerText = 'Copy';
                }, 2000);
            }, (err) => {
                console.error('Failed to copy text: ', err);
            });
        });

        pre.appendChild(button);
    });
});
