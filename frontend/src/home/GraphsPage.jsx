import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function AgePlot() {
  const [figure, setFigure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFigure() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/admin/ageplot", {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load age plot");
        }

        if (!cancelled) {
          setFigure(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load age plot");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFigure();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div>Loading age plot...</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>{error}</div>;
  }

  if (!figure) {
    return <div>No age plot data available.</div>;
  }

  return (
    <Plot
      data={figure.data || []}
      layout={figure.layout || {}}
      config={figure.config || { responsive: true }}
      style={{ width: "100%", height: "100%" }}
      useResizeHandler
    />
  );
}