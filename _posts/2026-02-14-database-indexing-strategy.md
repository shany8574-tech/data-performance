---
layout: post
title: "데이터베이스 인덱싱 전략: B-Tree부터 파티셔닝까지 완벽 가이드"
date: 2026-02-14
category: "Database"
description: "데이터베이스 인덱스의 내부 구조를 이해하고, 실무에서 적용할 수 있는 인덱싱 전략과 파티셔닝 기법을 소개합니다."
tags: [Database, 인덱스, B-Tree, 파티셔닝, PostgreSQL]
icon: "fas fa-sitemap"
banner_class: "database"
read_time: "12분"
---

인덱스는 데이터베이스 성능의 핵심입니다. 하지만 잘못된 인덱스는 오히려 성능을 저하시킬 수 있습니다. 이 포스트에서는 인덱스의 내부 구조를 이해하고, 실무에서 효과적인 인덱싱 전략을 수립하는 방법을 알아봅니다.

## 인덱스의 기본 원리

### B-Tree 인덱스 구조

B-Tree는 대부분의 RDBMS에서 기본 인덱스 구조로 사용됩니다.

```
                    [Root Node]
                   /     |      \
            [Branch]  [Branch]  [Branch]
           /   |   \     |      /   |
       [Leaf] [Leaf] [Leaf] [Leaf] [Leaf]
        ↓↓↓    ↓↓↓    ↓↓↓    ↓↓↓    ↓↓↓
       Data   Data   Data   Data   Data
```

**핵심 특성:**
- 균형 트리: 모든 리프 노드의 깊이가 동일
- O(log n) 검색 복잡도
- 범위 검색에 효율적 (리프 노드 간 연결)

### 인덱스 타입별 비교

| 인덱스 타입 | 장점 | 단점 | 적합한 용도 |
|-------------|------|------|-------------|
| **B-Tree** | 범위 검색, 정렬 | 높은 카디널리티 필요 | 일반적인 조회 |
| **Hash** | 등호 검색 매우 빠름 | 범위 검색 불가 | Key-Value 조회 |
| **GIN** | 배열, 전문 검색 | 갱신 비용 높음 | JSONB, 텍스트 검색 |
| **GiST** | 공간 데이터, 범위 타입 | 일반 조회 비효율 | 지리 정보, 범위 |
| **BRIN** | 저장 공간 최소 | 정렬된 데이터만 | 시계열 데이터 |

## 실전 인덱싱 전략

### 1. 선택도(Selectivity) 기반 인덱스 설계

```sql
-- 선택도 분석 쿼리
SELECT 
    column_name,
    n_distinct,
    most_common_vals,
    most_common_freqs
FROM pg_stats 
WHERE tablename = 'orders';

-- 선택도 계산
SELECT 
    COUNT(DISTINCT status) AS status_distinct,        -- 5 (낮은 선택도)
    COUNT(DISTINCT customer_id) AS customer_distinct,  -- 50,000 (높은 선택도)
    COUNT(DISTINCT order_date) AS date_distinct,       -- 730 (중간 선택도)
    COUNT(*) AS total_rows
FROM orders;
```

> **원칙**: 선택도가 높은(DISTINCT 값이 많은) 컬럼을 인덱스 선두에 배치

### 2. 복합 인덱스 설계 규칙

```sql
-- WHERE절 분석
-- Query 1: WHERE status = 'ACTIVE' AND created_at > '2025-01-01'
-- Query 2: WHERE status = 'ACTIVE' AND customer_id = 12345
-- Query 3: WHERE customer_id = 12345 AND created_at > '2025-01-01'

-- 최적의 복합 인덱스 설계
CREATE INDEX idx_orders_status_customer_date 
ON orders(status, customer_id, created_at);
```

**ESR 규칙 (Equal, Sort, Range):**
1. **E**quality 조건 컬럼이 가장 먼저
2. **S**ort (ORDER BY) 컬럼이 그 다음
3. **R**ange 조건 컬럼이 마지막

```sql
-- Query: WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 10
-- ESR 규칙 적용:
CREATE INDEX idx_orders_esr ON orders(status, created_at DESC);
```

### 3. 부분 인덱스 (Partial Index)

데이터의 특정 부분집합만 인덱싱하여 공간과 성능을 최적화합니다.

```sql
-- 전체 인덱스: 100만 행 모두 인덱싱
CREATE INDEX idx_orders_status ON orders(status);

-- 부분 인덱스: 'PENDING' 상태만 인덱싱 (전체의 5%)
CREATE INDEX idx_orders_pending 
ON orders(created_at) 
WHERE status = 'PENDING';

-- 90% 이상의 인덱스 크기 절약 가능!
```

## 파티셔닝 전략

### Range 파티셔닝

시계열 데이터에 가장 적합한 파티셔닝 전략입니다.

```sql
-- 월별 파티셔닝
CREATE TABLE orders (
    order_id    BIGSERIAL,
    order_date  TIMESTAMP NOT NULL,
    customer_id INT NOT NULL,
    total_amount DECIMAL(12,2),
    status      VARCHAR(20)
) PARTITION BY RANGE (order_date);

-- 파티션 생성
CREATE TABLE orders_2025_01 PARTITION OF orders
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE orders_2025_02 PARTITION OF orders
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... 나머지 월별 파티션
```

### 파티션 프루닝(Pruning) 효과

```sql
-- 파티션 프루닝: 2025년 1월 파티션만 스캔
EXPLAIN ANALYZE
SELECT * FROM orders 
WHERE order_date >= '2025-01-15' AND order_date < '2025-01-20';

-- 결과: orders_2025_01 파티션만 접근 (12개월 중 1개)
-- 약 92%의 I/O 절감!
```

<div class="chart-container">
  <h4 style="margin-bottom: 16px; text-align: center;">파티셔닝 적용 전후 성능 비교</h4>
  <canvas id="partitionChart" height="200"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('partitionChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['100만', '500만', '1000만', '5000만', '1억'],
        datasets: [
          {
            label: '파티셔닝 없음',
            data: [120, 580, 1200, 6500, 15000],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: '파티셔닝 적용',
            data: [50, 80, 120, 200, 350],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: { 
            beginAtZero: true, 
            title: { display: true, text: '쿼리 응답 시간 (ms)' },
            grid: { color: 'rgba(148,163,184,0.1)' }
          },
          x: { 
            title: { display: true, text: '데이터 건수' },
            grid: { display: false }
          }
        }
      }
    });
  }
});
</script>

## 인덱스 모니터링

### 미사용 인덱스 찾기

```sql
-- PostgreSQL: 사용되지 않는 인덱스 찾기
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan AS times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;
```

### 인덱스 효율성 체크

```sql
-- 인덱스 대비 테이블 크기 비율 확인
SELECT
    t.tablename,
    pg_size_pretty(pg_total_relation_size(t.tablename::regclass)) AS total_size,
    pg_size_pretty(pg_relation_size(t.tablename::regclass)) AS table_size,
    pg_size_pretty(
        pg_total_relation_size(t.tablename::regclass) - 
        pg_relation_size(t.tablename::regclass)
    ) AS index_size,
    ROUND(
        (pg_total_relation_size(t.tablename::regclass) - 
         pg_relation_size(t.tablename::regclass))::numeric / 
        pg_total_relation_size(t.tablename::regclass) * 100, 1
    ) AS index_ratio_pct
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(t.tablename::regclass) DESC;
```

<div class="highlight-box">
<h4><i class="fas fa-lightbulb"></i> 인덱스 설계 황금 규칙</h4>

1. **측정 먼저, 최적화 나중에** - 감이 아닌 데이터로 판단
2. **과도한 인덱스 금지** - DML 성능 저하 유발
3. **복합 인덱스 우선** - 단일 컬럼 인덱스 여러 개보다 효율적
4. **주기적 정리** - 미사용 인덱스는 과감히 제거
5. **통계 최신화** - ANALYZE를 주기적으로 실행
</div>

## 마무리

인덱스 설계는 데이터의 특성, 쿼리 패턴, 그리고 시스템 요구사항을 종합적으로 고려해야 하는 작업입니다. 위의 전략들을 기반으로 자신의 데이터에 맞는 최적의 인덱싱 전략을 수립해 보세요.
