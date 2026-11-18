(function () {
  "use strict";

  // =========================================================
  // KONSTANTA
  // =========================================================
  const WARNA_JENIS = {
    "Listrik": "#3b82f6",
    "Tempat":  "#f59e0b",
    "Air":     "#8b5cf6",
  };

  const URUTAN_JENIS = ["Listrik", "Tempat", "Air"];

  // =========================================================
  // HELPER FORMAT
  // =========================================================
  function formatRupiah(value) {
    return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value || 0));
  }

  function formatSingkat(value) {
    const abs = Math.abs(value);
    if (abs >= 1e12) return (value / 1e12).toFixed(1).replace(".", ",") + " T";
    if (abs >= 1e9)  return (value / 1e9).toFixed(1).replace(".", ",") + " M";
    if (abs >= 1e6)  return (value / 1e6).toFixed(1).replace(".", ",") + " Jt";
    if (abs >= 1e3)  return (value / 1e3).toFixed(0) + " rb";
    return value.toString();
  }

  function formatAngka(value) {
    return new Intl.NumberFormat("id-ID").format(Math.round(value || 0));
  }

  function formatShortAxis(value) {
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(1).replace(".", ",") + "B";
    if (abs >= 1e6) return (value / 1e6).toFixed(1).replace(".", ",") + "M";
    if (abs >= 1e3) return (value / 1e3).toFixed(0) + "rb";
    return value.toString();
  }

  // =========================================================
  // HELPER: GET CANVAS
  // =========================================================
  function getCanvas(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    if (el.tagName === "CANVAS") return el;

    const canvas = document.createElement("canvas");
    canvas.id = id + "-canvas";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    el.innerHTML = "";
    el.appendChild(canvas);
    return canvas;
  }

  // =========================================================
  // HELPER: READ JSON
  // =========================================================
  function readJSON(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (e) {
      console.error("Gagal parse JSON #" + id + ":", e);
      return null;
    }
  }

  // =========================================================
  // HELPER: SAFE NEW CHART
  // =========================================================
  function safeNewChart(elementId, config, retryCount) {
    retryCount = retryCount || 0;
    const MAX_RETRY = 20;

    const el = document.getElementById(elementId);
    if (!el) {
      console.error("Element #" + elementId + " tidak ditemukan");
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      if (retryCount < MAX_RETRY) {
        setTimeout(() => safeNewChart(elementId, config, retryCount + 1), 100);
        return;
      } else {
        console.error("Element #" + elementId + " ukuran 0 setelah retry");
        return;
      }
    }

    try {
      const existingCanvas = el.tagName === "CANVAS" ? el : el.querySelector("canvas");
      if (existingCanvas) {
        const existingChart = Chart.getChart(existingCanvas);
        if (existingChart) existingChart.destroy();
      }
    } catch (e) { /* ignore */ }

    const canvas = getCanvas(elementId);
    if (!canvas) return;

    try {
      new Chart(canvas, config);
      console.log("✅ Chart #" + elementId + " dibuat");
    } catch (e) {
      console.error("❌ Gagal chart #" + elementId + ":", e);
    }
  }

  // =========================================================
  // AMBIL DATA
  // =========================================================
  const dataCabang = readJSON("chartCabangData");
  const dataPasar = readJSON("chartPasarData");
  const dataDistribusi = readJSON("chartDistribusiData");
  const dataTren = readJSON("chartTrenData");

  if (typeof Chart === "undefined") {
    console.error("❌ Chart.js belum dimuat!");
    return;
  }

  const HAS_DATALABELS = typeof ChartDataLabels !== "undefined";
  console.log("Plugin DataLabels:", HAS_DATALABELS ? "✅ aktif" : "❌ tidak ada");

  // =========================================================
  // CHART: NILAI TAGIHAN PER CABANG
  // =========================================================
  function buildChartCabang() {
    if (!dataCabang) return;

    safeNewChart("chartCabang", {
      type: "bar",
      data: {
        labels: dataCabang.labels,
        datasets: [{
          label: "Total Nilai",
          data: dataCabang.values,
          backgroundColor: "#3b82f6",
          borderRadius: 4,
          barPercentage: 0.5,
          categoryPercentage: 0.6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 30 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => formatRupiah(ctx.parsed.y) }
          },
          datalabels: {
            anchor: "end",
            align: "top",
            offset: 4,
            color: "#1f2937",
            font: { size: 11, weight: "600" },
            formatter: (value) => {
              if (!value || value === 0) return "";
              return formatSingkat(value);
            },
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#374151", font: { size: 12 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: "#f1f5f9" },
            ticks: {
              color: "#6b7280",
              font: { size: 11 },
              callback: (v) => formatShortAxis(v)
            }
          }
        }
      }
    });
  }

  // =========================================================
  // CHART: DISTRIBUSI JENIS TAGIHAN (Donut)
  // =========================================================
  function buildChartDistribusi() {
    if (!dataDistribusi) return;

    const colors = dataDistribusi.labels.map(
      (label) => WARNA_JENIS[label] || "#94a3b8"
    );
    const total = dataDistribusi.values.reduce((a, b) => a + b, 0);

    safeNewChart("chartDistribusi", {
      type: "doughnut",
      data: {
        labels: dataDistribusi.labels,
        datasets: [{
          data: dataDistribusi.values,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "55%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { font: { size: 11 }, padding: 12, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed;
                const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                return `${ctx.label}: ${formatRupiah(v)} (${pct}%)`;
              }
            }
          },
          datalabels: {
            color: "#ffffff",
            font: { size: 11, weight: "700" },
            textAlign: "center",
            formatter: (value) => {
              if (!value || value === 0) return "";
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
              return pct + "%\n" + formatSingkat(value);
            },
            display: (ctx) => {
              const value = ctx.dataset.data[ctx.dataIndex];
              const pct = total > 0 ? (value / total) * 100 : 0;
              return pct >= 3;
            },
          }
        }
      }
    });
  }

  // =========================================================
  // CHART: NILAI TAGIHAN PER PASAR (Grouped Bar)
  // =========================================================
  function buildChartPasar() {
    if (!dataPasar) return;

    let datasets = [];
    if (Array.isArray(dataPasar.series) && dataPasar.series.length > 0) {
      datasets = dataPasar.series.map((s) => ({
        label: s.name,
        data: s.values,
        backgroundColor: WARNA_JENIS[s.name] || "#94a3b8",
        borderRadius: 3,
        barPercentage: 0.7,
        categoryPercentage: 0.7,
      }));
    } else {
      datasets = [
        { label: "Listrik", data: dataPasar.listrik || [], backgroundColor: WARNA_JENIS["Listrik"], borderRadius: 3, barPercentage: 0.7, categoryPercentage: 0.7 },
        { label: "Tempat",  data: dataPasar.tempat || [],  backgroundColor: WARNA_JENIS["Tempat"],  borderRadius: 3, barPercentage: 0.7, categoryPercentage: 0.7 },
        { label: "Air",     data: dataPasar.air || [],     backgroundColor: WARNA_JENIS["Air"],     borderRadius: 3, barPercentage: 0.7, categoryPercentage: 0.7 },
      ];
    }

    datasets.sort((a, b) => {
      const ia = URUTAN_JENIS.indexOf(a.label);
      const ib = URUTAN_JENIS.indexOf(b.label);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    safeNewChart("chartPasar", {
      type: "bar",
      data: { labels: dataPasar.labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 30 } },
        plugins: {
          legend: {
            position: "top",
            labels: { font: { size: 11 }, padding: 12, usePointStyle: true }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatRupiah(ctx.parsed.y)}`
            }
          },
          datalabels: {
            anchor: "end",
            align: "top",
            offset: 4,
            color: "#1f2937",
            font: { size: 9, weight: "600" },
            rotation: -90,
            formatter: (value) => {
              if (!value || value === 0) return "";
              return formatSingkat(value);
            },
            display: (ctx) => {
              const value = ctx.dataset.data[ctx.dataIndex];
              return value && value > 0;
            },
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#374151", font: { size: 10 }, maxRotation: 45, minRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: "#f1f5f9" },
            ticks: { color: "#6b7280", font: { size: 11 }, callback: (v) => formatShortAxis(v) }
          }
        }
      }
    });
  }

  // =========================================================
  // CHART: TREN
  // =========================================================
  function buildChartTren() {
    if (!dataTren) return;

    safeNewChart("chartTren", {
      type: "line",
      data: {
        labels: dataTren.labels,
        datasets: [{
          label: "Total Nilai",
          data: dataTren.values,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.15)",
          fill: true,
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 5,
          pointBackgroundColor: "#3b82f6",
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => formatRupiah(ctx.parsed.y) }
          },
          datalabels: { display: false }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#374151", font: { size: 10 }, maxRotation: 45, minRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: "#f1f5f9" },
            ticks: { color: "#6b7280", font: { size: 11 }, callback: (v) => formatShortAxis(v) }
          }
        }
      }
    });
  }

  // =========================================================
  // MULTI-SELECT DROPDOWN FILTER
  // =========================================================
  const MS_STORAGE_PREFIX = "dashboardFilter:";

  function msGetStore(name) {
    try {
      const raw = sessionStorage.getItem(MS_STORAGE_PREFIX + name);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function msSetStore(name, values) {
    try {
      sessionStorage.setItem(MS_STORAGE_PREFIX + name, JSON.stringify(values));
    } catch (e) { /* ignore (private mode, quota) */ }
  }

  function msClearStore() {
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.indexOf(MS_STORAGE_PREFIX) === 0) {
          sessionStorage.removeItem(k);
        }
      });
    } catch (e) { /* ignore */ }
  }

  function msInitOne(dropdown) {
    const name = dropdown.getAttribute("data-ms-name");
    const toggle = dropdown.querySelector(".ms-toggle");
    const label = dropdown.querySelector(".ms-label");
    const badge = dropdown.querySelector(".ms-badge");
    const panel = dropdown.querySelector(".ms-panel");
    const search = dropdown.querySelector(".ms-search");
    const options = dropdown.querySelectorAll(".ms-option");
    const emptyMsg = dropdown.querySelector(".ms-empty");

    if (!toggle || !panel) return;

    function getCheckboxes() {
      return dropdown.querySelectorAll('input[type="checkbox"]');
    }

    function getCheckedValues() {
      const result = [];
      getCheckboxes().forEach((cb) => {
        if (cb.checked) result.push(cb.value);
      });
      return result;
    }

    function setCheckedValues(values) {
      const set = new Set(values);
      getCheckboxes().forEach((cb) => {
        cb.checked = set.has(cb.value);
      });
    }

    function updateUI() {
      const checked = getCheckedValues();
      const total = getCheckboxes().length;

      // Badge jumlah
      if (badge) {
        if (checked.length > 0) {
          badge.textContent = String(checked.length);
          badge.classList.remove("d-none");
        } else {
          badge.textContent = "0";
          badge.classList.add("d-none");
        }
      }

      // Label tombol
      if (label) {
        if (checked.length === 0) {
          label.textContent = "Pilih " + (name === "jenis" ? "Jenis Tagihan" :
                                            name === "pasar" ? "Pasar" :
                                            name === "tahun" ? "Tahun" : "Cabang") + "…";
          label.classList.remove("has-value");
        } else if (checked.length === total && total > 0) {
          label.textContent = "Semua " + (name === "pasar" ? "Pasar" :
                                          name === "tahun" ? "Tahun" :
                                          name === "jenis" ? "Jenis" : "Cabang") +
                                          " (" + total + ")";
          label.classList.add("has-value");
        } else if (checked.length === 1) {
          label.textContent = checked[0];
          label.classList.add("has-value");
        } else {
          label.textContent = checked.length + " dipilih";
          label.classList.add("has-value");
        }
      }

      // Simpan ke sessionStorage (hanya yg checked agar ringan)
      msSetStore(name, checked);
    }

    // Toggle panel
    toggle.addEventListener("click", function (e) {
      e.preventDefault();
      const isOpen = !panel.classList.contains("d-none");
      // Tutup semua dropdown lain
      document.querySelectorAll(".ms-dropdown .ms-panel").forEach((p) => {
        if (p !== panel) p.classList.add("d-none");
      });
      document.querySelectorAll(".ms-dropdown .ms-toggle").forEach((t) => {
        if (t !== toggle) t.setAttribute("aria-expanded", "false");
      });

      if (isOpen) {
        panel.classList.add("d-none");
        toggle.setAttribute("aria-expanded", "false");
      } else {
        panel.classList.remove("d-none");
        toggle.setAttribute("aria-expanded", "true");
        if (search && !search.closest(".d-none")) {
          // hanya auto-focus kalau search terlihat
          setTimeout(() => { try { search.focus(); } catch (e) {} }, 0);
        }
      }
    });

    // Checkbox berubah
    getCheckboxes().forEach((cb) => {
      cb.addEventListener("change", updateUI);
    });

    // Search
    if (search) {
      search.addEventListener("input", function () {
        const q = search.value.trim().toLowerCase();
        let visibleCount = 0;
        options.forEach((opt) => {
          const text = opt.textContent.toLowerCase();
          const match = q === "" || text.indexOf(q) !== -1;
          opt.style.display = match ? "" : "none";
          if (match) visibleCount++;
        });
        if (emptyMsg) {
          emptyMsg.classList.toggle("d-none", visibleCount !== 0);
        }
      });
      // Reset search saat panel ditutup
      search.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          panel.classList.add("d-none");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }

    // Restore dari sessionStorage kalau URL tidak membawa nilai eksplisit
    // (artinya user belum menekan Terapkan → checkbox kosong dari server)
    const urlParam = name === "jenis" ? "jenis" : name;
    const hasUrlParam = new URLSearchParams(window.location.search).has(urlParam);
    if (!hasUrlParam) {
      const stored = msGetStore(name);
      if (stored && stored.length > 0) {
        setCheckedValues(stored);
      }
    }

    updateUI();
  }

  function initMultiSelect() {
    const dropdowns = document.querySelectorAll(".ms-dropdown");
    if (!dropdowns.length) return;

    dropdowns.forEach((d) => msInitOne(d));

    // Klik di luar → tutup semua panel
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".ms-dropdown")) {
        document.querySelectorAll(".ms-dropdown .ms-panel").forEach((p) => {
          p.classList.add("d-none");
        });
        document.querySelectorAll(".ms-dropdown .ms-toggle").forEach((t) => {
          t.setAttribute("aria-expanded", "false");
        });
      }
    });

    // ESC global
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".ms-dropdown .ms-panel").forEach((p) => {
          p.classList.add("d-none");
        });
        document.querySelectorAll(".ms-dropdown .ms-toggle").forEach((t) => {
          t.setAttribute("aria-expanded", "false");
        });
      }
    });

    // Form submit → clear sessionStorage (server jadi source of truth)
    const form = document.getElementById("dashboardFilterForm");
    if (form) {
      form.addEventListener("submit", function () {
        msClearStore();
      });
    }

    // Tombol reset → clear sessionStorage juga
    const btnReset = document.getElementById("btnResetFilter");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        msClearStore();
      });
    }

    console.log("✅ Multi-select filter siap (" + dropdowns.length + " dropdown)");
  }

  // =========================================================
  // INIT
  // =========================================================
  document.addEventListener("DOMContentLoaded", function () {
    console.log("=== Dashboard.js starting ===");

    // Inisialisasi filter dulu (sinkron, tidak butuh Chart.js)
    initMultiSelect();

    console.log("typeof Chart:", typeof Chart);
    console.log("ChartDataLabels:", typeof ChartDataLabels);
    console.log("dataCabang:", dataCabang);

    setTimeout(function () {
      buildChartCabang();
      buildChartDistribusi();
      buildChartPasar();
      buildChartTren();
      console.log("=== Semua chart selesai ===");
    }, 100);
  });

})();
