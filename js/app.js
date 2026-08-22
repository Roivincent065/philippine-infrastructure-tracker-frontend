
document.addEventListener('DOMContentLoaded', () => {
  const state = {
    search: '',
    status: '',
    category: '',
    district: '',
    year: '',
    sort: 'startDate',
    order: 'desc',
    page: 1,
    limit: 25,
  };

  const el = {
    statsStrip: document.getElementById('stats-strip'),
    searchInput: document.getElementById('search-input'),
    filterStatus: document.getElementById('filter-status'),
    filterCategory: document.getElementById('filter-category'),
    filterDistrict: document.getElementById('filter-district'),
    filterYear: document.getElementById('filter-year'),
    sortSelect: document.getElementById('sort-select'),
    filterClear: document.getElementById('filter-clear'),
    resultCount: document.getElementById('result-count'),
    projectList: document.getElementById('project-list'),
    pagination: document.getElementById('pagination'),
    signboardRoot: document.getElementById('signboard-root'),
  };

  let activeContractId = null;
  let searchDebounceTimer = null;

  MapModule.init();

  init();

  async function init() {
    await Promise.all([loadStatistics(), loadFilterOptions()]);
    await refresh();
  }

  // -------------------- Statistics strip --------------------

  async function loadStatistics() {
    try {
      const stats = await API.getStatistics();
      el.statsStrip.innerHTML = `
        ${statCell('Total Projects', stats.totalProjects)}
        ${statCell('Ongoing', stats.ongoingProjects)}
        ${statCell('Completed', stats.completedProjects)}
        ${statCell('For Procurement', stats.plannedProjects)}
        ${statCell('Flood Control', stats.floodControlProjects, true)}
        ${statCell('Total Cost', ProjectUI.formatCurrency(stats.totalProjectCost), true)}
      `;
    } catch (err) {
      el.statsStrip.innerHTML = `<div class="stat-cell"><span class="stat-cell__label">Statistics unavailable — ${err.message}</span></div>`;
    }
  }

  function statCell(label, value, signal = false) {
    return `
      <div class="stat-cell${signal ? ' stat-cell--signal' : ''}">
        <span class="stat-cell__value">${typeof value === 'number' ? value.toLocaleString() : value}</span>
        <span class="stat-cell__label">${label}</span>
      </div>`;
  }

  // -------------------- Filter dropdowns --------------------

  async function loadFilterOptions() {
    try {
      const options = await API.getFilterOptions();
      populateSelect(el.filterStatus, options.statuses);
      populateSelect(el.filterCategory, options.categories);
      populateSelect(el.filterDistrict, options.districts);
      populateSelect(el.filterYear, options.years, true);
    } catch (err) {
      console.error('Failed to load filter options', err);
    }
  }

  function populateSelect(selectEl, values, isYear = false) {
    values.forEach((v) => {
      if (v === null || v === undefined || v === '') return;
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = isYear ? v : v;
      selectEl.appendChild(opt);
    });
  }

  // -------------------- Query building + fetch --------------------

  function buildQueryParams() {
    return {
      search: state.search,
      status: state.status,
      category: state.category,
      district: state.district,
      yearFrom: state.year,
      yearTo: state.year,
      sort: state.sort,
      order: state.order,
      page: state.page,
      limit: state.limit,
    };
  }

  async function refresh() {
    ProjectUI.renderLoading(el.projectList);
    const params = buildQueryParams();

    try {
      const [listResult, locations] = await Promise.all([
        API.getProjects(params),
        API.getLocations(params),
      ]);

      renderResults(listResult);
      MapModule.setMarkers(locations, { onMarkerClick: selectProject });
    } catch (err) {
      ProjectUI.renderError(el.projectList, err.message);
      el.resultCount.textContent = '';
      el.pagination.innerHTML = '';
    }
  }

  function renderResults(listResult) {
    const { data, pagination } = listResult;

    ProjectUI.renderList(el.projectList, data, {
      activeContractId,
      onSelect: selectProject,
    });

    ProjectUI.renderPagination(el.pagination, pagination, (newPage) => {
      state.page = newPage;
      refresh();
      el.projectList.scrollTop = 0;
    });

    el.resultCount.textContent = pagination.total > 0
      ? `${pagination.total.toLocaleString()} project${pagination.total === 1 ? '' : 's'} match current filters`
      : '';
  }

  // -------------------- Selection: list <-> map <-> signboard --------------------

  async function selectProject(contractId) {
    activeContractId = contractId;

    document.querySelectorAll('.project-card').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.contractId === contractId);
    });

    MapModule.focusMarker(contractId);

    try {
      const project = await API.getProjectById(contractId);
      ProjectUI.openSignboard(el.signboardRoot, project, () => {
        activeContractId = null;
      });
    } catch (err) {
      console.error('Failed to load project details', err);
    }
  }

  // -------------------- Event wiring --------------------

  el.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.page = 1;
      refresh();
    }, 350);
  });

  el.filterStatus.addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; refresh(); });
  el.filterCategory.addEventListener('change', (e) => { state.category = e.target.value; state.page = 1; refresh(); });
  el.filterDistrict.addEventListener('change', (e) => { state.district = e.target.value; state.page = 1; refresh(); });
  el.filterYear.addEventListener('change', (e) => { state.year = e.target.value; state.page = 1; refresh(); });

  el.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    refresh();
  });

  el.filterClear.addEventListener('click', () => {
    state.search = '';
    state.status = '';
    state.category = '';
    state.district = '';
    state.year = '';
    state.sort = 'startDate';
    state.page = 1;

    el.searchInput.value = '';
    el.filterStatus.value = '';
    el.filterCategory.value = '';
    el.filterDistrict.value = '';
    el.filterYear.value = '';
    el.sortSelect.value = 'startDate';

    refresh();
  });
});
