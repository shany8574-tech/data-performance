---
layout: project
title: "SQL Query Performance Optimizer"
description: "대규모 데이터베이스의 슬로우 쿼리를 자동으로 감지하고 최적화 방안을 제안하는 Python 도구"
category: "SQL Tuning"
icon: "fas fa-bolt"
tech_stack: [Python, PostgreSQL, SQLAlchemy, Pandas]
github_url: "https://github.com/shany8574-tech/data-performance"
order: 1
---

## 프로젝트 개요

대규모 데이터베이스 환경에서 성능 저하를 유발하는 슬로우 쿼리를 자동으로 감지하고, 실행 계획 분석을 기반으로 최적화 방안을 제안하는 도구입니다.

## 주요 기능

- **슬로우 쿼리 자동 감지**: `pg_stat_statements` 기반 실시간 모니터링
- **실행 계획 분석**: EXPLAIN ANALYZE 결과 자동 파싱 및 분석
- **인덱스 추천**: 쿼리 패턴 분석 기반 최적 인덱스 제안
- **성능 리포트**: Before/After 비교 리포트 자동 생성

## 기술적 챌린지

### 1. 실행 계획 파싱

PostgreSQL의 EXPLAIN ANALYZE 결과를 트리 구조로 파싱하여 각 노드별 비용과 실행 시간을 분석합니다.

```python
def parse_explain_plan(plan_text):
    """실행 계획을 트리 구조로 파싱"""
    nodes = []
    for line in plan_text.split('\n'):
        indent = len(line) - len(line.lstrip())
        node_type = extract_node_type(line)
        cost = extract_cost(line)
        rows = extract_rows(line)
        
        nodes.append({
            'level': indent // 2,
            'type': node_type,
            'cost': cost,
            'rows': rows,
            'is_bottleneck': cost > threshold
        })
    return nodes
```

### 2. 인덱스 추천 알고리즘

WHERE 절과 JOIN 조건을 분석하여 최적의 인덱스 조합을 제안합니다.

```python
def recommend_indexes(query_patterns):
    """쿼리 패턴 기반 인덱스 추천"""
    recommendations = []
    
    for pattern in query_patterns:
        columns = extract_filter_columns(pattern)
        selectivity = calculate_selectivity(columns)
        
        # ESR 규칙 적용 (Equality, Sort, Range)
        ordered = sort_by_esr(columns, pattern)
        
        recommendations.append({
            'columns': ordered,
            'estimated_improvement': estimate_improvement(pattern, ordered),
            'create_statement': generate_create_index(ordered)
        })
    
    return recommendations
```

## 성과

| 지표 | Before | After | 개선율 |
|------|--------|-------|--------|
| 평균 쿼리 시간 | 850ms | 45ms | 94.7% |
| P95 응답 시간 | 3,200ms | 180ms | 94.4% |
| Full Scan 비율 | 35% | 3% | 91.4% |
| 일일 슬로우 쿼리 | 2,300건 | 120건 | 94.8% |

## 아키텍처

```
┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  PostgreSQL   │ ──→ │  Query Analyzer │ ──→ │   Reporter   │
│ (pg_stat_*)   │     │  (Python)       │     │  (HTML/PDF)  │
└──────────────┘     └────────────────┘     └──────────────┘
                            │
                     ┌──────┴──────┐
                     │  Index      │
                     │  Recommender│
                     └─────────────┘
```
