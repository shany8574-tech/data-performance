---
layout: post
title: "Python으로 데이터 분석 & 시각화: Pandas와 Matplotlib 실전 가이드"
date: 2026-02-12
category: "Python Analysis"
description: "Python의 Pandas와 Matplotlib을 활용하여 데이터를 분석하고 인사이트를 시각화하는 실전 기법을 소개합니다."
tags: [Python, Pandas, Matplotlib, 데이터분석, 시각화]
icon: "fab fa-python"
banner_class: "python"
read_time: "10분"
---

데이터 엔지니어에게 Python은 필수 도구입니다. 이 포스트에서는 Pandas로 데이터를 다루고, Matplotlib과 Seaborn으로 시각화하는 실전 워크플로우를 다룹니다.

## 환경 설정

```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

# 스타일 설정
plt.style.use('seaborn-v0_8-darkgrid')
sns.set_palette("husl")
plt.rcParams['font.family'] = 'Malgun Gothic'  # 한글 지원
plt.rcParams['figure.figsize'] = (12, 6)
plt.rcParams['figure.dpi'] = 100
```

## 1. 데이터 로드 및 전처리

실제 데이터베이스 성능 로그를 분석하는 시나리오를 다뤄보겠습니다.

```python
# 데이터베이스 쿼리 성능 로그 생성 (실전 시뮬레이션)
np.random.seed(42)
n_records = 10000

df = pd.DataFrame({
    'timestamp': pd.date_range('2025-01-01', periods=n_records, freq='5min'),
    'query_type': np.random.choice(['SELECT', 'INSERT', 'UPDATE', 'DELETE'], n_records, 
                                     p=[0.6, 0.2, 0.15, 0.05]),
    'execution_time_ms': np.random.lognormal(mean=3, sigma=1.5, size=n_records).round(2),
    'rows_examined': np.random.randint(1, 100000, n_records),
    'rows_returned': np.random.randint(0, 5000, n_records),
    'index_used': np.random.choice([True, False], n_records, p=[0.7, 0.3]),
    'table_name': np.random.choice(['orders', 'customers', 'products', 'inventory', 'logs'], n_records),
})

print(f"데이터 shape: {df.shape}")
print(f"\n기본 통계:\n{df.describe()}")
```

### 데이터 품질 체크

```python
# 결측값 및 이상치 확인
print("=== 결측값 확인 ===")
print(df.isnull().sum())

print("\n=== 실행 시간 분포 ===")
print(f"평균: {df['execution_time_ms'].mean():.2f}ms")
print(f"중앙값: {df['execution_time_ms'].median():.2f}ms")
print(f"95 percentile: {df['execution_time_ms'].quantile(0.95):.2f}ms")
print(f"99 percentile: {df['execution_time_ms'].quantile(0.99):.2f}ms")

# 슬로우 쿼리 식별 (95 percentile 이상)
threshold = df['execution_time_ms'].quantile(0.95)
slow_queries = df[df['execution_time_ms'] > threshold]
print(f"\n슬로우 쿼리 수: {len(slow_queries)} ({len(slow_queries)/len(df)*100:.1f}%)")
```

## 2. 핵심 분석 패턴

### 시간대별 쿼리 성능 분석

```python
# 시간대별 집계
df['hour'] = df['timestamp'].dt.hour
hourly_stats = df.groupby('hour').agg(
    avg_execution_time=('execution_time_ms', 'mean'),
    p95_execution_time=('execution_time_ms', lambda x: x.quantile(0.95)),
    query_count=('execution_time_ms', 'count'),
    slow_query_ratio=('execution_time_ms', lambda x: (x > threshold).mean() * 100)
).round(2)

print(hourly_stats)
```

### 테이블별 성능 분석

```python
# 테이블별 쿼리 성능 비교
table_analysis = df.groupby('table_name').agg(
    total_queries=('execution_time_ms', 'count'),
    avg_time=('execution_time_ms', 'mean'),
    max_time=('execution_time_ms', 'max'),
    index_usage_rate=('index_used', 'mean'),
    avg_rows_examined=('rows_examined', 'mean')
).round(2)

table_analysis['index_usage_rate'] = (table_analysis['index_usage_rate'] * 100).round(1)
table_analysis.sort_values('avg_time', ascending=False, inplace=True)
print(table_analysis)
```

## 3. 시각화

### 쿼리 실행 시간 분포

```python
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# 히스토그램
axes[0].hist(df['execution_time_ms'], bins=50, color='#3b82f6', 
             alpha=0.7, edgecolor='white')
axes[0].axvline(threshold, color='#ef4444', linestyle='--', 
                label=f'P95: {threshold:.0f}ms')
axes[0].set_xlabel('실행 시간 (ms)')
axes[0].set_ylabel('쿼리 수')
axes[0].set_title('쿼리 실행 시간 분포')
axes[0].legend()
axes[0].set_xlim(0, threshold * 3)

# 박스플롯: 쿼리 타입별
df.boxplot(column='execution_time_ms', by='query_type', ax=axes[1],
           patch_artist=True)
axes[1].set_title('쿼리 타입별 실행 시간')
axes[1].set_xlabel('쿼리 타입')
axes[1].set_ylabel('실행 시간 (ms)')
axes[1].set_ylim(0, threshold * 2)

plt.tight_layout()
plt.savefig('query_distribution.png', dpi=150, bbox_inches='tight')
plt.show()
```

### 시간대별 성능 히트맵

```python
# 요일 x 시간대 히트맵
df['day_of_week'] = df['timestamp'].dt.day_name()
pivot = df.pivot_table(
    values='execution_time_ms', 
    index='day_of_week', 
    columns='hour', 
    aggfunc='mean'
)

day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
pivot = pivot.reindex(day_order)

fig, ax = plt.subplots(figsize=(16, 6))
sns.heatmap(pivot, cmap='YlOrRd', annot=False, fmt='.0f', 
            linewidths=0.5, ax=ax, cbar_kws={'label': 'Avg Execution Time (ms)'})
ax.set_title('요일 × 시간대별 평균 쿼리 실행 시간')
ax.set_xlabel('시간')
ax.set_ylabel('요일')
plt.tight_layout()
plt.savefig('performance_heatmap.png', dpi=150, bbox_inches='tight')
plt.show()
```

### 인덱스 사용 효과 분석

```python
fig, axes = plt.subplots(1, 2, figsize=(14, 5))

# 인덱스 사용 여부별 실행 시간
colors = ['#10b981', '#ef4444']
index_groups = df.groupby('index_used')['execution_time_ms'].mean()
axes[0].bar(['Index Used', 'No Index'], index_groups.values, 
            color=colors, edgecolor='white', linewidth=2)
axes[0].set_ylabel('평균 실행 시간 (ms)')
axes[0].set_title('인덱스 사용 여부에 따른 성능 차이')

for i, v in enumerate(index_groups.values):
    axes[0].text(i, v + 1, f'{v:.1f}ms', ha='center', fontweight='bold')

# 테이블별 인덱스 사용률
table_idx = df.groupby('table_name')['index_used'].mean() * 100
table_idx.sort_values().plot(kind='barh', ax=axes[1], color='#3b82f6')
axes[1].set_xlabel('인덱스 사용률 (%)')
axes[1].set_title('테이블별 인덱스 사용률')
axes[1].axvline(70, color='#ef4444', linestyle='--', alpha=0.7, label='목표: 70%')
axes[1].legend()

plt.tight_layout()
plt.savefig('index_analysis.png', dpi=150, bbox_inches='tight')
plt.show()
```

## 4. 자동화된 성능 리포트 생성

```python
def generate_performance_report(df, output_file='performance_report.html'):
    """데이터베이스 성능 분석 자동 리포트 생성"""
    
    threshold_95 = df['execution_time_ms'].quantile(0.95)
    slow_queries = df[df['execution_time_ms'] > threshold_95]
    
    report = {
        '분석 기간': f"{df['timestamp'].min()} ~ {df['timestamp'].max()}",
        '총 쿼리 수': f"{len(df):,}",
        '평균 실행 시간': f"{df['execution_time_ms'].mean():.2f}ms",
        'P95 실행 시간': f"{threshold_95:.2f}ms",
        '슬로우 쿼리 비율': f"{len(slow_queries)/len(df)*100:.1f}%",
        '인덱스 사용률': f"{df['index_used'].mean()*100:.1f}%",
    }
    
    # 가장 느린 테이블 TOP 3
    worst_tables = df.groupby('table_name')['execution_time_ms'].mean()\
                     .sort_values(ascending=False).head(3)
    
    print("=" * 50)
    print("     Database Performance Report")
    print("=" * 50)
    for key, value in report.items():
        print(f"  {key}: {value}")
    print("\n  [주의 필요 테이블]")
    for table, avg_time in worst_tables.items():
        print(f"    - {table}: 평균 {avg_time:.2f}ms")
    print("=" * 50)
    
    return report

report = generate_performance_report(df)
```

<div class="chart-container">
  <h4 style="margin-bottom: 16px; text-align: center;">쿼리 타입별 평균 실행 시간</h4>
  <canvas id="queryTypeChart" height="200"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('queryTypeChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
        datasets: [{
          data: [45.2, 12.8, 28.5, 8.3],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
          borderWidth: 2,
          borderColor: 'rgba(0,0,0,0.1)',
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.label + ': ' + ctx.raw + 'ms (avg)'; }
            }
          }
        }
      }
    });
  }
});
</script>

## 마무리

Python을 활용한 데이터 분석의 핵심은 **반복 가능한 워크플로우**를 구축하는 것입니다. 위의 코드를 기반으로 자동화된 성능 리포트 시스템을 만들면, 데이터베이스 성능 변화를 지속적으로 추적할 수 있습니다.

다음 포스트에서는 이 분석 결과를 기반으로 실제 인덱스를 추가하고 쿼리를 개선하는 과정을 다루겠습니다.
