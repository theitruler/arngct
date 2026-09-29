(() => {
  const instances = new Set();
  const values = (input) => input.value.split(',').map((tag) => tag.trim()).filter(Boolean);
  function mount(input, getTags) {
    if (input._tagPicker) return input._tagPicker;
    input.hidden = true;
    // The visible selector provides validation feedback; hidden inputs cannot be focused by the browser.
    input.required = false;
    const root = document.createElement('div'); root.className = 'tag-picker';
    root.dataset.for = input.id || input.name || input.dataset.field;
    const chips = document.createElement('div'); chips.className = 'tag-chips';
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Choose an existing tag or add a new tag');
    const newRow = document.createElement('div'); newRow.className = 'tag-new'; newRow.hidden = true;
    const newInput = document.createElement('input'); newInput.type = 'text'; newInput.maxLength = 40; newInput.placeholder = 'New tag name'; newInput.setAttribute('aria-label', 'New tag name');
    const add = document.createElement('button'); add.type = 'button'; add.className = 'row-action'; add.textContent = 'Add tag';
    const message = document.createElement('span'); message.className = 'tag-message'; message.setAttribute('role', 'status');
    newRow.append(newInput, add); root.append(chips, select, newRow, message);
    // Keep interactive controls outside a wrapping label.
    const wrapper = input.closest('label');
    if (wrapper) wrapper.after(root); else input.after(root);
    const render = () => {
      const current = values(input);
      chips.replaceChildren();
      current.forEach((tag) => { const chip = document.createElement('button'); chip.type = 'button'; chip.textContent = `${tag} ×`; chip.setAttribute('aria-label', `Remove tag ${tag}`); chip.addEventListener('click', () => set(current.filter((value) => value !== tag))); chips.append(chip); });
      select.replaceChildren(new Option('Choose an existing tag…', ''));
      [...new Set(getTags())].sort((a, b) => a.localeCompare(b)).filter((tag) => !current.includes(tag)).forEach((tag) => select.add(new Option(tag, tag)));
      select.add(new Option('+ Add new tag', '__new__'));
    };
    const set = (tags) => {
      try {
        input.value = tags.length ? window.GalleryData.parseTags(tags.join(',')).join(', ') : '';
        message.textContent = ''; input.dispatchEvent(new Event('input', { bubbles: true })); render();
      } catch (error) { message.textContent = error.message; }
    };
    select.addEventListener('change', () => {
      if (select.value === '__new__') { newRow.hidden = false; newInput.focus(); select.value = ''; }
      else if (select.value) set([...values(input), select.value]);
    });
    const addTag = () => {
      try {
        const tags = window.GalleryData.parseTags(newInput.value);
        if (tags.length !== 1) throw new Error('Enter one tag at a time.');
        set([...values(input), ...tags]);
        if (message.textContent) return;
        root.dispatchEvent(new CustomEvent('tag-created', { bubbles: true, detail: tags[0] }));
        newInput.value = ''; newRow.hidden = true; select.focus();
      } catch (error) { message.textContent = error.message; }
    };
    add.addEventListener('click', addTag);
    newInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); addTag(); } });
    input._tagPicker = { root, render }; instances.add(input._tagPicker); render(); return input._tagPicker;
  }
  const refresh = () => { instances.forEach((picker) => { if (!picker.root.isConnected) instances.delete(picker); else picker.render(); }); };
  window.TagPicker = { mount, refresh };
})();
