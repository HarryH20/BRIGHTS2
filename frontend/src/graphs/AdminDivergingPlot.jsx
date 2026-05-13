import React, { useEffect, useState, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { divergingBarToEcharts } from "../lib/plotlyToEcharts.js";

function AdminDivergingPlotInner({ figure: prefetchedFigure }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [loading, setLoading] = useState(prefetchedFigure === undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefetchedFigure !== undefined) {
      setFigure(prefetchedFigure ?? null);
      setLoading(false);
      setError(null);
    }
  }, [prefetchedFigure]);

  useEffect(() => {
    if (prefetchedFigure !== undefined) return;
    setLoading(true);
    fetch("/api/admin/divergingstackedbarchart", { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(fig => { setFigure(fig); setError(null); })
      .catch(err => setError(err.message || "Failed to load goal progress chart."))
      .finally(() => setLoading(false));
  }, [prefetchedFigure]);

  const processedData = useMemo(() => {
    if (!figure) return null;

    const clonedFigure = JSON.parse(JSON.stringify(figure));

    const rawText = clonedFigure.layout?.title?.text || "";
    const titleLines = rawText
      .replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines
      .replace(/<[^>]*>?/gm, '')     // Strip other HTML tags
      .split('\n')
      .map(s => s.trim())
      .filter(s => s && s !== "Goal Progress"); // Remove empty lines and redundant prefix

    clonedFigure.layout.title.text = "";
    const origMarginT = clonedFigure.layout.margin?.t || 100;
    const newMarginT = 40; // Just enough room for the legend
    
    if (clonedFigure.layout.margin) {
      clonedFigure.layout.margin.t = newMarginT;
    }

    const heightReduction = Math.max(0, origMarginT - newMarginT);
    if (clonedFigure.layout.height) {
      clonedFigure.layout.height -= heightReduction;
    }

    Object.keys(clonedFigure.layout).forEach(key => {
      if (key.startsWith('xaxis')) {
        if (!clonedFigure.layout[key]) clonedFigure.layout[key] = {};
        clonedFigure.layout[key].range = [-100, 100];
        clonedFigure.layout[key].autorange = false;
      }
    });

    const option = divergingBarToEcharts(clonedFigure);
    if (!option) return null;

    const { _totalHeight, ...restOption } = option;

    if (restOption.legend) {
      const legends = Array.isArray(restOption.legend) ? restOption.legend : [restOption.legend];
      legends.forEach(l => { 
        l.top = 0; 
        delete l.y; 
        delete l.bottom; 
      });
    }

    if (restOption.xAxis) {
      const axes = Array.isArray(restOption.xAxis) ? restOption.xAxis : [restOption.xAxis];
      axes.forEach(ax => { 
        ax.min = -100; 
        ax.max = 100; 
      });
    }

    return {
      echartsOption: restOption,
      titleLines: titleLines,
      canvasHeight: clonedFigure.layout.height || 600
    };
  }, [figure]);

  // Calculate the total height for the wrapper (Canvas Height + Estimated Native HTML Height)
  const totalWrapperHeight = processedData 
    ? processedData.canvasHeight + (processedData.titleLines.length * 24) + 20 
    : 600;

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !processedData}
      title="Goal-Related Belief Changes by Week"
      subtitle="Percentage of participants who agree or disagree with each statement, compared to neutral. Blue = agreement, Orange = disagreement."
      height={totalWrapperHeight}
    >
      {processedData && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          
          {/* NATIVE HTML TEXT: Bypasses ECharts completely for perfect spacing */}
          <div style={{ textAlign: 'center', color: '#e9eefc', fontFamily: 'Arial, sans-serif', marginBottom: 10 }}>
            {processedData.titleLines.map((line, idx) => {
              const isHeader = line.startsWith('User #') || line.startsWith('All Users');
              return (
                <div 
                  key={idx} 
                  style={{
                    fontSize: isHeader ? 20 : 15,
                    fontWeight: isHeader ? 'bold' : 'normal',
                    marginTop: idx === 1 ? 6 : 2 // Small gap between header and goals
                  }}
                >
                  {line}
                </div>
              );
            })}
          </div>

          {/* ECHARTS CANVAS: Now only handles the charts and legend */}
          <ReactECharts
            option={processedData.echartsOption}
            opts={{ renderer: 'svg' }}
            style={{ height: processedData.canvasHeight, width: '100%' }}
            notMerge
          />
          
        </div>
      )}
    </AdminChartWrapper>
  );
}

export default function AdminDivergingPlot(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminDivergingPlotInner {...props} />
    </AppErrorBoundary>
  );
}
