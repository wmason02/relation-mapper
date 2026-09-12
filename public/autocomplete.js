(function () {
    let namesPromise = null;

    function loadNames() {
        if (!namesPromise) {
            namesPromise = fetch('/names')
                .then(res => res.json())
                .catch(err => {
                    console.error('Error fetching names:', err);
                    return [];
                });
        }
        return namesPromise;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function highlightMatch(name, query) {
        const idx = name.toLowerCase().indexOf(query.toLowerCase());
        if (idx === -1 || !query) return escapeHtml(name);
        return (
            escapeHtml(name.slice(0, idx)) +
            '<mark>' + escapeHtml(name.slice(idx, idx + query.length)) + '</mark>' +
            escapeHtml(name.slice(idx + query.length))
        );
    }

    function attach(inputEl, hiddenIdEl) {
        const wrapper = document.createElement('div');
        wrapper.className = 'autocomplete';
        inputEl.parentNode.insertBefore(wrapper, inputEl);
        wrapper.appendChild(inputEl);

        const list = document.createElement('ul');
        list.className = 'autocomplete-suggestions';
        list.hidden = true;
        list.setAttribute('role', 'listbox');
        wrapper.appendChild(list);

        inputEl.removeAttribute('list');
        inputEl.setAttribute('role', 'combobox');
        inputEl.setAttribute('aria-expanded', 'false');
        inputEl.setAttribute('aria-autocomplete', 'list');

        let names = [];
        let matches = [];
        let activeIndex = -1;

        loadNames().then(data => { names = data; });

        function closeList() {
            list.hidden = true;
            list.innerHTML = '';
            activeIndex = -1;
            inputEl.setAttribute('aria-expanded', 'false');
            inputEl.removeAttribute('aria-activedescendant');
        }

        function setActive(index) {
            const items = list.querySelectorAll('.autocomplete-item');
            items.forEach(el => el.classList.remove('active'));
            if (index >= 0 && index < items.length) {
                items[index].classList.add('active');
                items[index].scrollIntoView({ block: 'nearest' });
                inputEl.setAttribute('aria-activedescendant', items[index].id);
            } else {
                inputEl.removeAttribute('aria-activedescendant');
            }
            activeIndex = index;
        }

        function selectPerson(person) {
            inputEl.value = person.name;
            hiddenIdEl.value = person._id;
            closeList();
        }

        function render() {
            const query = inputEl.value.trim();
            hiddenIdEl.value = '';

            if (!query) {
                closeList();
                return;
            }

            matches = names
                .filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8);

            const exact = names.find(p => p.name.toLowerCase() === query.toLowerCase());
            if (exact) hiddenIdEl.value = exact._id;

            list.innerHTML = '';

            if (matches.length === 0) {
                const empty = document.createElement('li');
                empty.className = 'autocomplete-empty';
                empty.textContent = 'No matches found';
                list.appendChild(empty);
            } else {
                matches.forEach((person, i) => {
                    const item = document.createElement('li');
                    item.className = 'autocomplete-item';
                    item.id = inputEl.id + '-option-' + i;
                    item.setAttribute('role', 'option');
                    item.innerHTML = highlightMatch(person.name, query);
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        selectPerson(person);
                    });
                    list.appendChild(item);
                });
            }

            list.hidden = false;
            activeIndex = -1;
            inputEl.setAttribute('aria-expanded', 'true');
        }

        inputEl.addEventListener('input', render);
        inputEl.addEventListener('focus', () => {
            if (inputEl.value.trim()) render();
        });

        inputEl.addEventListener('keydown', (e) => {
            const items = list.querySelectorAll('.autocomplete-item');
            if (list.hidden || items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(Math.min(activeIndex + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(Math.max(activeIndex - 1, 0));
            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && matches[activeIndex]) {
                    e.preventDefault();
                    selectPerson(matches[activeIndex]);
                }
            } else if (e.key === 'Escape') {
                closeList();
            }
        });

        inputEl.addEventListener('blur', () => {
            setTimeout(() => {
                if (!wrapper.contains(document.activeElement)) closeList();
            }, 100);
        });

        return { setValue: selectPerson };
    }

    window.NameAutocomplete = { loadNames, attach };
})();
