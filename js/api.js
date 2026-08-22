
const API = (() => {
  const BASE = '/api/projects';

  async function request(path, params = {}) {
    const url = new URL(BASE + path, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || `Request failed (${response.status})`);
    }
    return response.json();
  }

  return {
    // GET /api/projects?search=&status=&category=&district=&yearFrom=&yearTo=&sort=&order=&page=&limit=
    getProjects(params) {
      return request('', params);
    },
    // GET /api/projects/:contractId
    getProjectById(contractId) {
      return request(`/${encodeURIComponent(contractId)}`);
    },
    // GET /api/projects/statistics
    getStatistics() {
      return request('/statistics');
    },
    // GET /api/projects/locations (only rows with coordinates; respects same filters as getProjects)
    getLocations(params) {
      return request('/locations', params);
    },
    // GET /api/projects/filters (distinct values for populating dropdowns)
    getFilterOptions() {
      return request('/filters');
    },
  };
})();