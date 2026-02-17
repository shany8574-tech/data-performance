---
layout: project
title: "Database Performance Analyzer"
description: "Python으로 구축한 데이터베이스 성능 자동 분석 및 리포팅 시스템"
category: "Performance Analysis"
icon: "fas fa-microscope"
tech_stack: [Python, NumPy, Scikit-learn, Chart.js, PostgreSQL, Oracle]
github_url: "https://github.com/shany8574-tech/data-performance"
order: 3
---

## 프로젝트 개요

데이터베이스 성능 지표를 자동으로 수집하고, 머신러닝 기법을 활용하여 성능 이상을 탐지하며, 시각화 리포트를 자동 생성하는 종합 분석 시스템입니다.

## 주요 기능

- **자동 지표 수집**: PostgreSQL, Oracle의 핵심 성능 메트릭 수집
- **이상 탐지**: Isolation Forest 기반 이상 패턴 자동 감지
- **트렌드 분석**: 시계열 분석으로 성능 저하 추이 예측
- **자동 리포트**: HTML/PDF 형식의 분석 리포트 자동 생성

## 핵심 분석 코드

### Isolation Forest 기반 이상 탐지

```python
from sklearn.ensemble import IsolationForest
import pandas as pd
import numpy as np

class PerformanceAnomalyDetector:
    def __init__(self, contamination=0.05):
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
    
    def fit_detect(self, metrics_df):
        """성능 메트릭에서 이상치 탐지"""
        features = metrics_df[['avg_execution_time', 'cpu_usage', 
                                'io_wait', 'active_connections']]
        
        # 정규화
        features_normalized = (features - features.mean()) / features.std()
        
        # 이상치 탐지 (-1: 이상, 1: 정상)
        predictions = self.model.fit_predict(features_normalized)
        metrics_df['is_anomaly'] = predictions == -1
        
        anomalies = metrics_df[metrics_df['is_anomaly']]
        print(f"탐지된 이상 패턴: {len(anomalies)}건 / 전체 {len(metrics_df)}건")
        
        return anomalies
```

### 성능 트렌드 예측

```python
from sklearn.linear_model import LinearRegression

def predict_performance_trend(history_df, days_ahead=30):
    """성능 트렌드 예측"""
    
    df = history_df.copy()
    df['day_number'] = (df['date'] - df['date'].min()).dt.days
    
    X = df[['day_number']].values
    y = df['avg_response_time'].values
    
    model = LinearRegression()
    model.fit(X, y)
    
    future_days = np.arange(
        df['day_number'].max() + 1,
        df['day_number'].max() + days_ahead + 1
    ).reshape(-1, 1)
    
    predictions = model.predict(future_days)
    
    print(f"현재 평균 응답 시간: {y[-1]:.1f}ms")
    print(f"{days_ahead}일 후 예측: {predictions[-1]:.1f}ms")
    print(f"일일 증가율: {model.coef_[0]:.2f}ms/day")
    
    if predictions[-1] > threshold:
        print(f"⚠️ {days_ahead}일 내 임계값({threshold}ms) 초과 예상!")
    
    return predictions
```

## 분석 리포트 예시

시스템이 자동으로 생성하는 리포트에는 다음 항목이 포함됩니다:

1. **Executive Summary**: 핵심 성능 지표 요약
2. **Performance Trends**: 주요 메트릭의 시계열 추이
3. **Anomaly Report**: 감지된 이상 패턴 상세
4. **Top Slow Queries**: 성능 저하 유발 쿼리 TOP 10
5. **Recommendations**: AI 기반 최적화 제안

## 성과

| 지표 | 수치 |
|------|------|
| 이상 탐지 정확도 | 96.3% |
| 평균 탐지 시간 | < 5분 |
| False Positive Rate | 3.7% |
| 리포트 생성 시간 | < 30초 |
| 모니터링 대상 DB | 15개+ |
