
document.addEventListener('DOMContentLoaded', () => {
  const state = {
    search: '',
    status: '',
    category: '',
    district: '',
    year: '',
    budgetMin: '',
    budgetMax: '',
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
    budgetMin: document.getElementById('budget-min'),
    budgetMax: document.getElementById('budget-max'),
    budgetRangeLabel: document.getElementById('budget-range-label'),
    sortSelect: document.getElementById('sort-select'),
    filterClear: document.getElementById('filter-clear'),
    resultCount: document.getElementById('result-count'),
    projectList: document.getElementById('project-list'),
    pagination: document.getElementById('pagination'),
    signboardRoot: document.getElementById('signboard-root'),
    mapMode: document.getElementById('map-mode'),
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
      setupBudgetFilter(options.budgetMin, options.budgetMax);
    } catch (err) {
      console.error('Failed to load filter options', err);
    }
  }

  function setupBudgetFilter(minimum, maximum) {
    const suppliedMin = Number(minimum);
    const suppliedMax = Number(maximum);
    const min = Number.isFinite(suppliedMin) && suppliedMin >= 0
      ? Math.floor(suppliedMin / 1000000) * 1000000
      : 0;
    const max = Number.isFinite(suppliedMax) && suppliedMax > min
      ? Math.ceil(suppliedMax / 1000000) * 1000000
      : 200000000;

    [el.budgetMin, el.budgetMax].forEach((input) => {
      input.min = min;
      input.max = max;
      input.step = 1000000;
    });
    el.budgetMin.value = min;
    el.budgetMax.value = max;
    updateBudgetLabel();

    const updateRange = (changedInput) => {
      const otherInput = changedInput === el.budgetMin ? el.budgetMax : el.budgetMin;
      if (Number(changedInput.value) > Number(otherInput.value)) {
        otherInput.value = changedInput.value;
      }
      state.budgetMin = Number(el.budgetMin.value) > min ? el.budgetMin.value : '';
      state.budgetMax = Number(el.budgetMax.value) < max ? el.budgetMax.value : '';
      updateBudgetLabel();
    };

    el.budgetMin.addEventListener('input', () => updateRange(el.budgetMin));
    el.budgetMax.addEventListener('input', () => updateRange(el.budgetMax));
    [el.budgetMin, el.budgetMax].forEach((input) => input.addEventListener('change', () => {
      state.page = 1;
      refresh();
    }));
  }

  function updateBudgetLabel() {
    const min = Number(el.budgetMin.value);
    const max = Number(el.budgetMax.value);
    const floor = Number(el.budgetMin.min);
    const ceiling = Number(el.budgetMax.max);
    if (min === floor && max === ceiling) {
      el.budgetRangeLabel.textContent = 'All budgets';
      return;
    }
    el.budgetRangeLabel.textContent = `${ProjectUI.formatCurrency(min)} – ${ProjectUI.formatCurrency(max)}`;
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
      budgetMin: state.budgetMin,
      budgetMax: state.budgetMax,
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
    state.budgetMin = '';
    state.budgetMax = '';
    state.sort = 'startDate';
    state.page = 1;

    el.searchInput.value = '';
    el.filterStatus.value = '';
    el.filterCategory.value = '';
    el.filterDistrict.value = '';
    el.filterYear.value = '';
    el.budgetMin.value = el.budgetMin.min;
    el.budgetMax.value = el.budgetMax.max;
    updateBudgetLabel();
    el.sortSelect.value = 'startDate';

    refresh();
  });

  el.mapMode.addEventListener('change', (e) => {
    MapModule.setDisplayMode(e.target.value);
  });
});
