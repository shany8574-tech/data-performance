---
layout: post
title: "SQL 쿼리 튜닝의 기초: 실행 계획 읽는 법부터 인덱스 전략까지"
date: 2026-02-10
category: "SQL Tuning"
description: "SQL 쿼리 성능을 획기적으로 개선하는 실전 튜닝 기법을 소개합니다. 실행 계획 분석부터 인덱스 설계까지 핵심을 다룹니다."
tags: [SQL, 쿼리튜닝, 실행계획, 인덱스, 성능최적화]
icon: "fas fa-database"
banner_class: "sql"
read_time: "8분"
---

데이터베이스 성능 문제의 80%는 비효율적인 SQL 쿼리에서 시작됩니다. 이 포스트에서는 쿼리 튜닝의 기초부터 실전 적용까지 단계별로 알아보겠습니다.

## 왜 쿼리 튜닝이 중요한가?

애플리케이션이 느려지는 대부분의 원인은 데이터베이스 레이어에 있습니다. 하나의 쿼리를 최적화하면 전체 시스템 응답 시간이 극적으로 개선될 수 있습니다.

> "가장 빠른 쿼리는 실행하지 않는 쿼리다" - 불필요한 데이터 접근을 최소화하는 것이 튜닝의 핵심

## 실행 계획(Execution Plan) 읽기

실행 계획은 DBMS가 쿼리를 어떻게 처리할지 보여주는 로드맵입니다.

### PostgreSQL에서 실행 계획 확인하기

```sql
EXPLAIN ANALYZE
SELECT o.order_id, c.customer_name, p.product_name
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
JOIN products p ON o.product_id = p.product_id
WHERE o.order_date >= '2025-01-01'
  AND o.status = 'COMPLETED'
ORDER BY o.order_date DESC
LIMIT 100;
```

### 실행 계획 핵심 지표

| 지표 | 설명 | 주의 기준 |
|------|------|-----------|
| **Seq Scan** | 테이블 전체 스캔 | 대용량 테이블에서 발생 시 위험 |
| **Index Scan** | 인덱스를 통한 접근 | 일반적으로 양호 |
| **Nested Loop** | 중첩 반복 조인 | 대량 데이터 시 비효율적 |
| **Hash Join** | 해시 기반 조인 | 대량 데이터 시 효율적 |
| **Sort** | 정렬 작업 | 메모리 사용량 확인 필요 |
| **Rows** | 예상 처리 행 수 | 실제와 차이가 크면 통계 갱신 필요 |

## 인덱스 전략

### 1. 복합 인덱스의 컬럼 순서

복합 인덱스에서 컬럼 순서는 성능에 결정적인 영향을 미칩니다.

```sql
-- 비효율적: status의 카디널리티가 낮음 (3개 값)
CREATE INDEX idx_orders_bad ON orders(status, order_date);

-- 효율적: order_date가 먼저 오면 범위 검색에 유리
CREATE INDEX idx_orders_good ON orders(order_date, status);
```

**원칙**: 등호(=) 조건 컬럼을 앞에, 범위(>, <, BETWEEN) 조건 컬럼을 뒤에 배치합니다.

### 2. 커버링 인덱스

쿼리에서 필요한 모든 컬럼이 인덱스에 포함되면, 테이블 접근 없이 인덱스만으로 결과를 반환할 수 있습니다.

```sql
-- 커버링 인덱스 생성
CREATE INDEX idx_orders_covering 
ON orders(order_date, status) 
INCLUDE (customer_id, total_amount);

-- 이 쿼리는 테이블 접근 없이 인덱스만으로 처리
SELECT order_date, status, customer_id, total_amount
FROM orders
WHERE order_date >= '2025-01-01' AND status = 'COMPLETED';
```

### 3. 인덱스가 무시되는 경우

```sql
-- 인덱스 컬럼에 함수 적용 → Full Scan
SELECT * FROM orders WHERE YEAR(order_date) = 2025;

-- 개선: SARGable(Search ARGument ABLE) 조건으로 변경
SELECT * FROM orders 
WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01';

-- 암묵적 형변환 → 인덱스 무시
SELECT * FROM users WHERE phone = 01012345678;  -- 숫자

-- 개선: 문자열로 비교
SELECT * FROM users WHERE phone = '01012345678';
```

## 실전 튜닝 사례: 3.2초 → 0.05초

### Before: 느린 쿼리

```sql
SELECT *
FROM orders o
WHERE EXISTS (
    SELECT 1 FROM order_items oi 
    WHERE oi.order_id = o.order_id
    AND oi.product_id IN (
        SELECT product_id FROM products 
        WHERE category = '전자기기'
    )
)
AND YEAR(o.order_date) = 2025
ORDER BY o.order_date DESC;
```

**문제점 분석:**
- `YEAR()` 함수로 인해 인덱스 사용 불가
- 중첩 서브쿼리로 인한 반복적인 테이블 접근
- `SELECT *`로 불필요한 컬럼 조회

### After: 최적화된 쿼리

```sql
SELECT o.order_id, o.order_date, o.status, o.total_amount
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id
WHERE p.category = '전자기기'
  AND o.order_date >= '2025-01-01' 
  AND o.order_date < '2026-01-01'
ORDER BY o.order_date DESC;
```

**개선 포인트:**
1. SARGable 조건으로 변경 → 인덱스 활용
2. EXISTS + IN 서브쿼리를 JOIN으로 변환
3. 필요한 컬럼만 명시적으로 SELECT

<div class="chart-container">
  <h4 style="margin-bottom: 16px; text-align: center;">쿼리 실행 시간 비교</h4>
  <canvas id="queryChart" height="200"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('queryChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Original Query', 'After Index', 'After JOIN Rewrite', 'Final Optimized'],
        datasets: [{
          label: '실행 시간 (ms)',
          data: [3200, 1500, 280, 50],
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'ms' }, grid: { color: 'rgba(148,163,184,0.1)' } },
          x: { grid: { display: false } }
        }
      }
    });
  }
});
</script>

## 튜닝 체크리스트

<div class="highlight-box">
<h4><i class="fas fa-check-circle"></i> SQL 튜닝 체크리스트</h4>

1. **실행 계획 확인** - EXPLAIN ANALYZE로 현재 상태 파악
2. **Full Scan 제거** - 적절한 인덱스 추가
3. **SARGable 조건** - 인덱스 컬럼에 함수 적용 제거
4. **JOIN 최적화** - 서브쿼리를 JOIN으로 변환 검토
5. **SELECT 절 최소화** - 필요한 컬럼만 조회
6. **통계 정보 갱신** - ANALYZE 명령으로 최신화
7. **실행 시간 측정** - 변경 전후 정량적 비교
</div>

## 마무리

쿼리 튜닝은 한 번에 완성되는 것이 아니라, 데이터 양이 늘어나고 사용 패턴이 변화함에 따라 지속적으로 관리해야 합니다. 다음 포스트에서는 Python을 활용한 쿼리 성능 자동 분석 방법을 다루겠습니다.
