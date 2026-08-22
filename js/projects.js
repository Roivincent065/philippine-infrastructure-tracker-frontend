
const ProjectUI = (() => {
  const STATUS_LABELS = {
    'Completed': 'completed',
    'On-Going': 'ongoing',
    'For Procurement': 'for-procurement',
    'Terminated': 'terminated',
  };

  function statusClass(status) {
    return STATUS_LABELS[status] || 'planned';
  }

  function formatCurrency(value) {
    const num = Number(value);
    if (!value || Number.isNaN(num) || num === 0) return '—';
    return '₱' + num.toLocaleString('en-PH', { maximumFractionDigits: 0 });
  }

  function formatDate(value) {
    if (!value) return '—';
    // API returns 'YYYY-MM-DD' strings (dateStrings: true in the pool config)
    const [y, m, d] = value.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  }

  function shortTitle(description, max = 90) {
    if (!description) return 'Untitled Project';
    return description.length > max ? description.slice(0, max).trim() + '…' : description;
  }

  // -------------------- Project list --------------------

  function renderList(container, projects, { activeContractId, onSelect } = {}) {
    if (!projects || projects.length === 0) {
      container.innerHTML = `
        <div class="state-message">
          <strong>No projects found</strong>
          Try clearing filters or using a different search term.
        </div>`;
      return;
    }

    container.innerHTML = '';
    projects.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.dataset.contractId = p.contract_id;
      if (p.contract_id === activeContractId) card.classList.add('is-active');

      card.innerHTML = `
        <div class="project-card__top">
          <p class="project-card__title">${escapeHtml(shortTitle(p.description))}</p>
          <span class="status-tag status-tag--${statusClass(p.status)}">${escapeHtml(p.status || 'Unknown')}</span>
        </div>
        <div class="project-card__meta">
          <span><strong>${formatCurrency(p.budget)}</strong></span>
          <span>${escapeHtml(p.component_categories || p.category || 'Uncategorized')}</span>
          <span>${escapeHtml(p.location_district || '')}</span>
          <span class="mono">${escapeHtml(p.contract_id)}</span>
        </div>
      `;
      card.addEventListener('click', () => onSelect && onSelect(p.contract_id));
      container.appendChild(card);
    });
  }

  function renderLoading(container) {
    container.innerHTML = `<div class="state-message"><strong>Loading&hellip;</strong>Fetching projects from the tracker API.</div>`;
  }

  function renderError(container, message) {
    container.innerHTML = `
      <div class="state-message">
        <strong>Couldn't load projects</strong>
        ${escapeHtml(message || 'The API might be unavailable. Please try again.')}
      </div>`;
  }

  // -------------------- Pagination --------------------

  function renderPagination(container, pagination, onPageChange) {
    if (!pagination || pagination.total === 0) {
      container.innerHTML = '';
      return;
    }

    const { page, limit, total, totalPages } = pagination;
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);

    container.innerHTML = `
      <span>Showing ${start}&ndash;${end} of ${total.toLocaleString()}</span>
      <div class="pagination__buttons">
        <button data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>&larr; Prev</button>
        <span>Page ${page} / ${totalPages}</span>
        <button data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
      </div>
    `;

    container.querySelectorAll('button[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page, 10)));
    });
  }

  // -------------------- Signboard detail panel --------------------

  function openSignboard(rootEl, project, onClose) {
    const cls = statusClass(project.status);

    rootEl.innerHTML = `
      <div class="signboard-overlay" role="dialog" aria-modal="true">
        <div class="signboard">
          <div class="signboard__band">
            <button class="signboard__close" aria-label="Close">&times;</button>
            <div class="signboard__band-label">Contract ${escapeHtml(project.contract_id)}</div>
            <h2 class="signboard__title">${escapeHtml(project.description)}</h2>
            <div class="signboard__stamp signboard__stamp--${cls}">${escapeHtml(project.status || 'Unknown')}</div>
          </div>
          <div class="signboard__body">
            ${row('Type', project.component_categories || project.category)}
            ${row('Budget', formatCurrency(project.budget), true)}
            ${row('Amount Paid', formatCurrency(project.amount_paid), true)}
            ${row('Progress', project.progress != null ? `${Number(project.progress)}%` : '—')}
            ${row('Contractor', project.contractor)}
            ${row('Start Date', formatDate(project.start_date))}
            ${row('Target Completion', formatDate(project.completion_date))}
            ${row('Funding Source', project.source_of_funds)}
            ${row('Program', project.program_name)}
            ${row('District Office', project.location_district)}
            ${row('Region', project.location_region)}
            ${project.latitude && project.longitude
              ? row('Coordinates', `${project.latitude}, ${project.longitude}`, true)
              : `<p class="signboard__coords-note">No GPS coordinates recorded for this project yet — it won't appear on the map.</p>`}
          </div>
        </div>
      </div>
    `;

    const overlay = rootEl.querySelector('.signboard-overlay');
    const close = () => {
      rootEl.innerHTML = '';
      onClose && onClose();
    };
    rootEl.querySelector('.signboard__close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  function closeSignboard(rootEl) {
    rootEl.innerHTML = '';
  }

  function row(label, value, mono = false) {
    return `
      <div class="signboard__row">
        <div class="signboard__row-label">${escapeHtml(label)}</div>
        <div class="signboard__row-value${mono ? ' mono' : ''}">${value ? escapeHtml(String(value)) : '—'}</div>
      </div>`;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    renderList,
    renderLoading,
    renderError,
    renderPagination,
    openSignboard,
    closeSignboard,
    formatCurrency,
    formatDate,
    statusClass,
  };
})();