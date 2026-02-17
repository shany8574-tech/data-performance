---
layout: project
title: "Data Pipeline Performance Dashboard"
description: "ETL 파이프라인의 실시간 성능 모니터링 및 시각화 대시보드"
category: "Data Engineering"
icon: "fas fa-chart-area"
tech_stack: [Python, Pandas, Matplotlib, Seaborn, PostgreSQL]
github_url: "https://github.com/shany8574-tech/data-performance"
order: 2
---

## 프로젝트 개요

대용량 ETL 파이프라인의 각 스테이지별 성능을 실시간으로 모니터링하고, Python 시각화 라이브러리를 활용하여 직관적인 대시보드를 제공하는 프로젝트입니다.

## 주요 기능

- **실시간 파이프라인 모니터링**: Extract → Transform → Load 각 단계 성능 추적
- **자동 이상 탐지**: 이동 평균 기반 Anomaly Detection
- **시각화 대시보드**: Matplotlib/Seaborn 기반 인터랙티브 차트
- **알림 시스템**: 임계값 초과 시 자동 알림

## 시각화 예시

### 파이프라인 처리량 추이

```python
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(14, 6))

hours = np.arange(0, 24)
extract_rate = np.array([1200,1100,900,800,750,700,800,1500,2800,3200,
                          3100,2900,2700,2800,3000,3200,3100,2600,2200,
                          1800,1500,1400,1300,1250])
transform_rate = extract_rate * 0.85
load_rate = transform_rate * 0.92

ax.fill_between(hours, extract_rate, alpha=0.3, color='#3b82f6', label='Extract')
ax.fill_between(hours, transform_rate, alpha=0.3, color='#10b981', label='Transform')
ax.fill_between(hours, load_rate, alpha=0.3, color='#f59e0b', label='Load')
ax.plot(hours, extract_rate, color='#3b82f6', linewidth=2)
ax.plot(hours, transform_rate, color='#10b981', linewidth=2)
ax.plot(hours, load_rate, color='#f59e0b', linewidth=2)

ax.set_xlabel('시간')
ax.set_ylabel('처리량 (rows/sec)')
ax.set_title('ETL 파이프라인 시간대별 처리량')
ax.legend()
plt.show()
```

### 데이터 품질 지표

```python
quality_metrics = {
    'completeness': 98.5,
    'accuracy': 99.2,
    'consistency': 97.8,
    'timeliness': 95.3,
    'uniqueness': 99.9,
}

fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True))

categories = list(quality_metrics.keys())
values = list(quality_metrics.values())
angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
values += values[:1]
angles += angles[:1]

ax.fill(angles, values, color='#3b82f6', alpha=0.25)
ax.plot(angles, values, color='#3b82f6', linewidth=2)
ax.set_xticks(angles[:-1])
ax.set_xticklabels(categories)
ax.set_ylim(90, 100)
ax.set_title('Data Quality Radar')
plt.show()
```

## 성과

- **처리 속도**: 시간당 1,200만 건 → 4,800만 건 (4배 향상)
- **장애 감지 시간**: 평균 30분 → 2분 (93% 단축)
- **데이터 품질**: 정확도 95% → 99.2%
- **운영 효율**: 수동 모니터링 시간 80% 절감

## 아키텍처

```
[Data Sources]  →  [Extract Layer]  →  [Transform Layer]  →  [Load Layer]
      │                   │                    │                   │
      └───────────────────┴────────────────────┴───────────────────┘
                                    │
                          [Metrics Collector]
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              [Dashboard]    [Alert System]    [Report Gen]
```
