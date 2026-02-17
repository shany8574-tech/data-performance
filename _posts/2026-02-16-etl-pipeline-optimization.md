---
layout: post
title: "ETL 파이프라인 최적화: 대용량 데이터를 10배 빠르게 처리하는 방법"
date: 2026-02-16
category: "Data Engineering"
description: "대용량 데이터 ETL 파이프라인의 병목을 찾고, Python으로 성능을 10배 이상 개선하는 실전 기법을 소개합니다."
tags: [ETL, 파이프라인, Python, 대용량데이터, 최적화]
icon: "fas fa-stream"
banner_class: "etl"
read_time: "10분"
---

ETL(Extract-Transform-Load) 파이프라인은 데이터 엔지니어링의 핵심입니다. 하지만 데이터 규모가 커질수록 성능 문제가 발생합니다. 이 포스트에서는 실전에서 ETL 파이프라인 성능을 극적으로 개선하는 방법을 다룹니다.

## ETL 파이프라인의 일반적인 병목

```
[Source DB] → Extract → [Staging] → Transform → [Target DB] → Load
     │                      │                         │
   느린 쿼리          메모리 부족            대량 INSERT
   네트워크 지연      비효율적 변환          인덱스 재생성
```

### 일반적인 문제 상황

| 단계 | 문제 | 영향 |
|------|------|------|
| **Extract** | SELECT * FROM large_table | 불필요한 데이터까지 추출 |
| **Transform** | Row-by-row 처리 | CPU 병목, 느린 처리 속도 |
| **Load** | 단건 INSERT | 네트워크 라운드트립 과다 |

## 1. Extract 최적화

### 증분 추출(Incremental Extract)

```python
import pandas as pd
from sqlalchemy import create_engine
from datetime import datetime, timedelta

engine = create_engine('postgresql://user:pass@localhost/source_db')

def incremental_extract(table_name, last_sync_time):
    """증분 추출: 마지막 동기화 이후 변경된 데이터만 추출"""
    
    query = f"""
    SELECT *
    FROM {table_name}
    WHERE updated_at > %(last_sync)s
    ORDER BY updated_at
    """
    
    # 청크 단위로 읽기 (메모리 효율적)
    chunks = pd.read_sql(
        query,
        engine,
        params={'last_sync': last_sync_time},
        chunksize=50000  # 5만 건씩 처리
    )
    
    for i, chunk in enumerate(chunks):
        print(f"Chunk {i+1}: {len(chunk)} rows extracted")
        yield chunk

# 사용
last_sync = datetime.now() - timedelta(hours=1)
for chunk in incremental_extract('orders', last_sync):
    process_chunk(chunk)
```

### 병렬 추출

```python
from concurrent.futures import ThreadPoolExecutor
import pandas as pd

def parallel_extract(tables, engine, max_workers=4):
    """여러 테이블을 병렬로 추출"""
    
    def extract_table(table_name):
        query = f"SELECT * FROM {table_name} WHERE updated_at > NOW() - INTERVAL '1 hour'"
        df = pd.read_sql(query, engine)
        print(f"  ✓ {table_name}: {len(df)} rows")
        return table_name, df
    
    results = {}
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(extract_table, t): t for t in tables}
        for future in futures:
            table_name, df = future.result()
            results[table_name] = df
    
    return results

# 4개 테이블 동시 추출
tables = ['orders', 'customers', 'products', 'inventory']
data = parallel_extract(tables, engine)
```

## 2. Transform 최적화

### Vectorized 연산 vs Row-by-row

```python
import pandas as pd
import numpy as np
import time

# 테스트 데이터 (100만 건)
n = 1_000_000
df = pd.DataFrame({
    'price': np.random.uniform(10, 1000, n),
    'quantity': np.random.randint(1, 100, n),
    'discount_rate': np.random.uniform(0, 0.3, n),
    'tax_rate': np.random.choice([0.1, 0.15, 0.2], n)
})

# ❌ 느린 방법: iterrows (Row-by-row)
start = time.time()
totals_slow = []
for idx, row in df.iterrows():
    total = row['price'] * row['quantity'] * (1 - row['discount_rate']) * (1 + row['tax_rate'])
    totals_slow.append(total)
df['total_slow'] = totals_slow
slow_time = time.time() - start
print(f"iterrows: {slow_time:.2f}초")

# ✅ 빠른 방법: Vectorized 연산
start = time.time()
df['total_fast'] = (
    df['price'] * df['quantity'] * 
    (1 - df['discount_rate']) * 
    (1 + df['tax_rate'])
)
fast_time = time.time() - start
print(f"Vectorized: {fast_time:.4f}초")

print(f"성능 향상: {slow_time/fast_time:.0f}배 빠름!")
```

### 대용량 데이터 청크 처리 패턴

```python
def transform_pipeline(input_path, output_path, chunksize=100000):
    """메모리 효율적인 청크 기반 변환 파이프라인"""
    
    total_rows = 0
    start_time = time.time()
    
    reader = pd.read_csv(input_path, chunksize=chunksize)
    
    for i, chunk in enumerate(reader):
        # 변환 로직
        chunk = clean_data(chunk)
        chunk = enrich_data(chunk)
        chunk = aggregate_metrics(chunk)
        
        # 결과 저장 (append 모드)
        mode = 'w' if i == 0 else 'a'
        header = (i == 0)
        chunk.to_csv(output_path, mode=mode, header=header, index=False)
        
        total_rows += len(chunk)
        elapsed = time.time() - start_time
        rate = total_rows / elapsed
        print(f"  Chunk {i+1}: {total_rows:,} rows processed ({rate:,.0f} rows/sec)")
    
    print(f"\nTotal: {total_rows:,} rows in {elapsed:.1f}s")

def clean_data(df):
    """데이터 정제"""
    df = df.dropna(subset=['customer_id', 'order_date'])
    df['order_date'] = pd.to_datetime(df['order_date'])
    df['total_amount'] = df['total_amount'].clip(lower=0)
    return df

def enrich_data(df):
    """데이터 보강"""
    df['year_month'] = df['order_date'].dt.to_period('M')
    df['is_high_value'] = df['total_amount'] > df['total_amount'].quantile(0.9)
    return df

def aggregate_metrics(df):
    """메트릭 집계"""
    df['running_total'] = df.groupby('customer_id')['total_amount'].cumsum()
    return df
```

## 3. Load 최적화

### Bulk Insert vs Single Insert

```python
import psycopg2
from psycopg2.extras import execute_values
import time

def load_comparison(df, connection_string):
    """단건 INSERT vs 벌크 INSERT 성능 비교"""
    
    conn = psycopg2.connect(connection_string)
    cur = conn.cursor()
    
    # ❌ 느린 방법: 단건 INSERT
    start = time.time()
    for _, row in df.iterrows():
        cur.execute(
            "INSERT INTO orders (id, date, amount) VALUES (%s, %s, %s)",
            (row['id'], row['date'], row['amount'])
        )
    conn.commit()
    single_time = time.time() - start
    
    # ✅ 빠른 방법: Bulk INSERT
    start = time.time()
    values = [tuple(row) for row in df[['id', 'date', 'amount']].values]
    execute_values(
        cur,
        "INSERT INTO orders (id, date, amount) VALUES %s",
        values,
        page_size=5000
    )
    conn.commit()
    bulk_time = time.time() - start
    
    print(f"Single INSERT: {single_time:.2f}s")
    print(f"Bulk INSERT:   {bulk_time:.2f}s")
    print(f"성능 향상: {single_time/bulk_time:.0f}배")
    
    cur.close()
    conn.close()
```

### COPY 명령어 활용 (PostgreSQL)

```python
import io

def load_with_copy(df, table_name, conn):
    """PostgreSQL COPY 명령어로 초고속 로드"""
    
    buffer = io.StringIO()
    df.to_csv(buffer, index=False, header=False, sep='\t')
    buffer.seek(0)
    
    cur = conn.cursor()
    
    # 인덱스 비활성화 (로드 속도 향상)
    cur.execute(f"ALTER TABLE {table_name} DISABLE TRIGGER ALL")
    
    # COPY 실행
    cur.copy_from(buffer, table_name, sep='\t', null='')
    
    # 인덱스 재활성화
    cur.execute(f"ALTER TABLE {table_name} ENABLE TRIGGER ALL")
    
    conn.commit()
    cur.close()
```

<div class="chart-container">
  <h4 style="margin-bottom: 16px; text-align: center;">ETL 최적화 기법별 처리 속도 비교</h4>
  <canvas id="etlChart" height="220"></canvas>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  const ctx = document.getElementById('etlChart');
  if (ctx) {
    new Chart(ctx, {
      type: 'radar',
      data: {
        labels: ['Extract 속도', 'Transform 속도', 'Load 속도', '메모리 효율', '확장성', '안정성'],
        datasets: [
          {
            label: '최적화 전',
            data: [30, 20, 25, 35, 20, 40],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            pointBackgroundColor: '#ef4444'
          },
          {
            label: '최적화 후',
            data: [85, 90, 88, 80, 85, 90],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            pointBackgroundColor: '#10b981'
          }
        ]
      },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(148,163,184,0.15)' },
            ticks: { display: false }
          }
        },
        plugins: { legend: { position: 'top' } }
      }
    });
  }
});
</script>

## 4. 전체 파이프라인 모니터링

```python
import logging
from datetime import datetime
from functools import wraps

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('etl_pipeline')

def monitor(stage_name):
    """ETL 스테이지 모니터링 데코레이터"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = datetime.now()
            logger.info(f"[{stage_name}] 시작")
            
            try:
                result = func(*args, **kwargs)
                elapsed = (datetime.now() - start).total_seconds()
                logger.info(f"[{stage_name}] 완료 ({elapsed:.2f}s)")
                return result
            except Exception as e:
                elapsed = (datetime.now() - start).total_seconds()
                logger.error(f"[{stage_name}] 실패 ({elapsed:.2f}s): {e}")
                raise
        
        return wrapper
    return decorator

@monitor("Extract")
def extract_data(source):
    pass

@monitor("Transform")  
def transform_data(data):
    pass

@monitor("Load")
def load_data(data, target):
    pass
```

<div class="highlight-box">
<h4><i class="fas fa-rocket"></i> ETL 최적화 핵심 원칙</h4>

1. **증분 처리** - 전체 재처리 대신 변경분만 처리
2. **청크 단위 처리** - 메모리를 초과하지 않도록 분할 처리
3. **벡터화 연산** - Row-by-row 대신 Pandas vectorized 연산 활용
4. **벌크 로드** - 단건 INSERT 대신 COPY 또는 Bulk INSERT
5. **병렬 처리** - 독립적인 작업은 동시 실행
6. **모니터링** - 각 단계의 성능 지표를 지속 추적
</div>

## 마무리

ETL 파이프라인 최적화는 단일 기법이 아닌, Extract-Transform-Load 각 단계에서의 종합적인 개선이 필요합니다. 위의 기법들을 실제 환경에 적용할 때는 반드시 벤치마크를 수행하고, 병목 지점을 정확히 파악한 후 최적화를 진행하세요.
