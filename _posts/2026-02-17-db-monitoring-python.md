---
layout: post
title: "Python으로 만드는 데이터베이스 성능 모니터링 대시보드"
date: 2026-02-17
category: "Monitoring"
description: "Python과 시각화 라이브러리를 활용하여 실시간 데이터베이스 성능 모니터링 시스템을 구축하는 방법을 소개합니다."
tags: [Python, 모니터링, 대시보드, 성능분석, 자동화]
icon: "fas fa-heartbeat"
banner_class: "monitoring"
read_time: "9분"
---

데이터베이스 성능 문제를 사전에 감지하려면 체계적인 모니터링 시스템이 필수입니다. 이 포스트에서는 Python으로 DB 성능 지표를 수집하고 시각화하는 모니터링 시스템을 구축하는 방법을 다룹니다.

## 모니터링 아키텍처

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  PostgreSQL  │ →  │   Collector   │ →  │   Dashboard   │
│   (Source)   │    │   (Python)    │    │  (Matplotlib) │
└─────────────┘    └──────────────┘    └───────────────┘
       │                  │                     │
  성능 지표 수집      데이터 저장/분석        시각화/알림
```

## 1. 핵심 성능 지표 수집

### PostgreSQL 성능 지표 수집기

```python
import psycopg2
import pandas as pd
from datetime import datetime
import json

class DBPerformanceCollector:
    """PostgreSQL 성능 지표 수집기"""
    
    def __init__(self, connection_string):
        self.conn_string = connection_string
    
    def get_connection(self):
        return psycopg2.connect(self.conn_string)
    
    def collect_query_stats(self):
        """쿼리 실행 통계 수집"""
        query = """
        SELECT 
            queryid,
            LEFT(query, 100) AS query_text,
            calls,
            total_exec_time / 1000 AS total_time_sec,
            mean_exec_time AS avg_time_ms,
            rows,
            shared_blks_hit,
            shared_blks_read,
            CASE WHEN shared_blks_hit + shared_blks_read > 0
                 THEN ROUND(shared_blks_hit::numeric / 
                      (shared_blks_hit + shared_blks_read) * 100, 2)
                 ELSE 0
            END AS cache_hit_ratio
        FROM pg_stat_statements
        ORDER BY total_exec_time DESC
        LIMIT 20;
        """
        
        with self.get_connection() as conn:
            return pd.read_sql(query, conn)
    
    def collect_table_stats(self):
        """테이블 통계 수집"""
        query = """
        SELECT 
            schemaname,
            relname AS table_name,
            seq_scan,
            seq_tup_read,
            idx_scan,
            idx_tup_fetch,
            n_tup_ins AS inserts,
            n_tup_upd AS updates,
            n_tup_del AS deletes,
            n_live_tup AS live_rows,
            n_dead_tup AS dead_rows,
            CASE WHEN n_live_tup > 0
                 THEN ROUND(n_dead_tup::numeric / n_live_tup * 100, 2)
                 ELSE 0
            END AS dead_row_ratio
        FROM pg_stat_user_tables
        ORDER BY seq_scan DESC;
        """
        
        with self.get_connection() as conn:
            return pd.read_sql(query, conn)
    
    def collect_connection_stats(self):
        """커넥션 통계 수집"""
        query = """
        SELECT 
            state,
            COUNT(*) AS count,
            MAX(EXTRACT(EPOCH FROM (NOW() - state_change)))::int AS max_duration_sec
        FROM pg_stat_activity
        WHERE pid != pg_backend_pid()
        GROUP BY state
        ORDER BY count DESC;
        """
        
        with self.get_connection() as conn:
            return pd.read_sql(query, conn)
    
    def collect_all_metrics(self):
        """전체 메트릭 수집"""
        timestamp = datetime.now()
        
        metrics = {
            'timestamp': timestamp,
            'query_stats': self.collect_query_stats(),
            'table_stats': self.collect_table_stats(),
            'connection_stats': self.collect_connection_stats(),
        }
        
        print(f"[{timestamp}] Metrics collected successfully")
        return metrics
```

## 2. 성능 데이터 분석

### 시계열 분석

```python
class PerformanceAnalyzer:
    """성능 데이터 분석기"""
    
    def __init__(self, history_df):
        self.df = history_df
    
    def detect_anomalies(self, column='avg_execution_time_ms', window=20, sigma=2):
        """이동 평균 기반 이상 탐지"""
        
        rolling_mean = self.df[column].rolling(window=window).mean()
        rolling_std = self.df[column].rolling(window=window).std()
        
        upper_bound = rolling_mean + (sigma * rolling_std)
        lower_bound = rolling_mean - (sigma * rolling_std)
        
        anomalies = self.df[
            (self.df[column] > upper_bound) | 
            (self.df[column] < lower_bound)
        ]
        
        return anomalies, upper_bound, lower_bound
    
    def trend_analysis(self, column='avg_execution_time_ms'):
        """트렌드 분석"""
        
        # 일별 평균
        daily = self.df.set_index('timestamp').resample('D')[column].agg([
            'mean', 'median', 
            ('p95', lambda x: x.quantile(0.95)),
            ('p99', lambda x: x.quantile(0.99))
        ])
        
        # 주간 대비 변화율
        weekly_change = daily['mean'].pct_change(periods=7) * 100
        
        return daily, weekly_change
    
    def generate_alerts(self, thresholds):
        """임계값 기반 알림 생성"""
        
        alerts = []
        latest = self.df.iloc[-1]
        
        if latest.get('avg_execution_time_ms', 0) > thresholds.get('max_avg_time', 1000):
            alerts.append({
                'level': 'CRITICAL',
                'message': f"평균 쿼리 시간 초과: {latest['avg_execution_time_ms']:.0f}ms"
            })
        
        if latest.get('cache_hit_ratio', 100) < thresholds.get('min_cache_hit', 90):
            alerts.append({
                'level': 'WARNING',
                'message': f"캐시 히트율 저하: {latest['cache_hit_ratio']:.1f}%"
            })
        
        if latest.get('dead_row_ratio', 0) > thresholds.get('max_dead_ratio', 10):
            alerts.append({
                'level': 'WARNING',
                'message': f"Dead row 비율 과다: {latest['dead_row_ratio']:.1f}% → VACUUM 필요"
            })
        
        return alerts
```

## 3. 시각화 대시보드

```python
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import numpy as np

def create_dashboard(metrics_history, save_path='dashboard.png'):
    """성능 모니터링 대시보드 생성"""
    
    fig = plt.figure(figsize=(20, 14))
    fig.patch.set_facecolor('#0b1120')
    gs = gridspec.GridSpec(3, 3, hspace=0.35, wspace=0.3)
    
    colors = {
        'bg': '#151f32',
        'text': '#f1f5f9',
        'grid': '#1e293b',
        'blue': '#3b82f6',
        'green': '#10b981',
        'red': '#ef4444',
        'yellow': '#f59e0b',
        'purple': '#8b5cf6'
    }
    
    # --- 1. 실행 시간 추이 ---
    ax1 = fig.add_subplot(gs[0, :2])
    ax1.set_facecolor(colors['bg'])
    
    timestamps = pd.date_range('2025-01-01', periods=100, freq='D')
    avg_times = np.random.lognormal(3, 0.5, 100).cumsum() / np.arange(1, 101) + 20
    p95_times = avg_times * np.random.uniform(2, 4, 100)
    
    ax1.plot(timestamps, avg_times, color=colors['blue'], linewidth=2, label='평균')
    ax1.plot(timestamps, p95_times, color=colors['red'], linewidth=1.5, 
             alpha=0.7, label='P95')
    ax1.fill_between(timestamps, avg_times, alpha=0.1, color=colors['blue'])
    ax1.set_title('쿼리 실행 시간 추이', color=colors['text'], fontsize=13, pad=10)
    ax1.legend(facecolor=colors['bg'], edgecolor=colors['grid'], 
               labelcolor=colors['text'])
    ax1.tick_params(colors=colors['text'])
    ax1.set_ylabel('실행 시간 (ms)', color=colors['text'])
    ax1.grid(True, color=colors['grid'], alpha=0.5)
    
    # --- 2. 캐시 히트율 게이지 ---
    ax2 = fig.add_subplot(gs[0, 2])
    ax2.set_facecolor(colors['bg'])
    
    cache_hit = 94.7
    wedge_colors = [colors['green'], colors['grid']]
    ax2.pie([cache_hit, 100-cache_hit], colors=wedge_colors, startangle=90,
            wedgeprops={'width': 0.3, 'edgecolor': colors['bg']})
    ax2.text(0, 0, f'{cache_hit}%', ha='center', va='center',
             fontsize=28, fontweight='bold', color=colors['green'])
    ax2.set_title('Cache Hit Ratio', color=colors['text'], fontsize=13, pad=10)
    
    # --- 3. 쿼리 타입별 분포 ---
    ax3 = fig.add_subplot(gs[1, 0])
    ax3.set_facecolor(colors['bg'])
    
    types = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    counts = [6200, 2100, 1400, 300]
    bar_colors = [colors['blue'], colors['green'], colors['yellow'], colors['red']]
    
    bars = ax3.barh(types, counts, color=bar_colors, edgecolor='none', height=0.6)
    ax3.set_title('쿼리 타입별 실행 횟수', color=colors['text'], fontsize=13, pad=10)
    ax3.tick_params(colors=colors['text'])
    ax3.set_xlabel('실행 횟수', color=colors['text'])
    ax3.grid(True, axis='x', color=colors['grid'], alpha=0.5)
    
    for bar, count in zip(bars, counts):
        ax3.text(bar.get_width() + 50, bar.get_y() + bar.get_height()/2,
                f'{count:,}', va='center', color=colors['text'], fontsize=10)
    
    # --- 4. 테이블별 성능 히트맵 ---
    ax4 = fig.add_subplot(gs[1, 1:])
    ax4.set_facecolor(colors['bg'])
    
    tables = ['orders', 'customers', 'products', 'inventory', 'logs']
    metrics_names = ['Seq Scan', 'Idx Scan', 'Dead Rows %', 'Avg Time']
    heatmap_data = np.random.rand(5, 4) * 100
    
    im = ax4.imshow(heatmap_data, cmap='YlOrRd', aspect='auto')
    ax4.set_xticks(range(4))
    ax4.set_xticklabels(metrics_names, color=colors['text'])
    ax4.set_yticks(range(5))
    ax4.set_yticklabels(tables, color=colors['text'])
    ax4.set_title('테이블별 성능 히트맵', color=colors['text'], fontsize=13, pad=10)
    plt.colorbar(im, ax=ax4, shrink=0.8)
    
    # --- 5. 커넥션 상태 ---
    ax5 = fig.add_subplot(gs[2, 0])
    ax5.set_facecolor(colors['bg'])
    
    states = ['active', 'idle', 'idle in\ntransaction']
    state_counts = [15, 42, 3]
    state_colors = [colors['green'], colors['blue'], colors['yellow']]
    
    ax5.bar(states, state_counts, color=state_colors, edgecolor='none', width=0.6)
    ax5.set_title('커넥션 상태', color=colors['text'], fontsize=13, pad=10)
    ax5.tick_params(colors=colors['text'])
    ax5.set_ylabel('커넥션 수', color=colors['text'])
    ax5.grid(True, axis='y', color=colors['grid'], alpha=0.5)
    
    # --- 6. 슬로우 쿼리 TOP 5 ---
    ax6 = fig.add_subplot(gs[2, 1:])
    ax6.set_facecolor(colors['bg'])
    ax6.axis('off')
    
    slow_queries = [
        ('SELECT * FROM orders WHERE...', '3,200ms', '12,453'),
        ('UPDATE inventory SET qty...', '2,100ms', '8,921'),
        ('SELECT c.name, o.total...', '1,800ms', '5,432'),
        ('INSERT INTO logs SELECT...', '1,500ms', '3,210'),
        ('DELETE FROM temp_orders...', '1,200ms', '2,100'),
    ]
    
    ax6.set_title('Slow Query TOP 5', color=colors['text'], fontsize=13, pad=10)
    
    col_labels = ['Query', 'Avg Time', 'Calls']
    table = ax6.table(
        cellText=slow_queries,
        colLabels=col_labels,
        loc='center',
        cellLoc='left'
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1, 1.5)
    
    for key, cell in table.get_celld().items():
        cell.set_edgecolor(colors['grid'])
        if key[0] == 0:
            cell.set_facecolor(colors['purple'])
            cell.set_text_props(color='white', fontweight='bold')
        else:
            cell.set_facecolor(colors['bg'])
            cell.set_text_props(color=colors['text'])
    
    plt.savefig(save_path, dpi=150, bbox_inches='tight', 
                facecolor=fig.get_facecolor())
    plt.show()
    print(f"Dashboard saved to {save_path}")
```

<div class="chart-container">
  <h4 style="margin-bottom: 16px; text-align: center;">실시간 성능 지표 (시뮬레이션)</h4>
  <canvas id="monitorChart" height="200"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('monitorChart');
  if (ctx) {
    const labels = Array.from({length: 24}, (_, i) => `${String(i).padStart(2,'0')}:00`);
    const avgTime = [35,32,28,25,23,22,25,45,78,95,88,72,65,70,82,90,85,75,60,55,48,42,38,36];
    const p95Time = avgTime.map(v => v * 2.5 + Math.random() * 20);
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '평균 응답 시간 (ms)',
            data: avgTime,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3
          },
          {
            label: 'P95 응답 시간 (ms)',
            data: p95Time,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.05)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            borderDash: [5, 5]
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'ms' }, grid: { color: 'rgba(148,163,184,0.1)' } },
          x: { title: { display: true, text: '시간' }, grid: { display: false } }
        }
      }
    });
  }
});
</script>

## 4. 자동 알림 시스템

```python
import smtplib
from email.mime.text import MIMEText

def send_alert(alerts, recipients):
    """성능 알림 발송"""
    
    if not alerts:
        return
    
    critical = [a for a in alerts if a['level'] == 'CRITICAL']
    warnings = [a for a in alerts if a['level'] == 'WARNING']
    
    body = "=== Database Performance Alert ===\n\n"
    
    if critical:
        body += "🔴 CRITICAL:\n"
        for a in critical:
            body += f"  - {a['message']}\n"
    
    if warnings:
        body += "\n🟡 WARNING:\n"
        for a in warnings:
            body += f"  - {a['message']}\n"
    
    body += f"\nGenerated at: {datetime.now()}"
    
    print(body)  # 또는 Slack/Email 발송

# 임계값 설정
thresholds = {
    'max_avg_time': 500,     # 평균 500ms 초과 시 CRITICAL
    'min_cache_hit': 90,      # 캐시 히트율 90% 미만 시 WARNING
    'max_dead_ratio': 10,     # Dead row 10% 초과 시 WARNING
}
```

<div class="highlight-box">
<h4><i class="fas fa-bell"></i> 모니터링 핵심 지표</h4>

| 지표 | 정상 기준 | 위험 기준 |
|------|-----------|-----------|
| 평균 쿼리 시간 | < 100ms | > 500ms |
| P95 쿼리 시간 | < 500ms | > 2,000ms |
| Cache Hit Ratio | > 95% | < 90% |
| Dead Row Ratio | < 5% | > 10% |
| Active Connections | < 80% | > 90% |
</div>

## 마무리

Python을 활용한 DB 모니터링 시스템은 복잡한 상용 솔루션 없이도 효과적인 성능 관리를 가능하게 합니다. 핵심은 **적절한 지표 선정**, **지속적인 수집**, **시각화를 통한 빠른 인사이트 도출**입니다.
