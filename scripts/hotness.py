"""V2: transparent, after-hours activity ranking, not intraday money flows."""
import math

WEIGHTS = {'amount': .35, 'relativeVolume': .25, 'turnoverRate': .20, 'amountAcceleration': .20}

def numeric(value):
    try:
        value = float(str(value).replace(',', ''))
        return value if math.isfinite(value) and value >= 0 else None
    except (ValueError, TypeError):
        return None

def average(rows, field):
    values = [numeric(r.get(field)) for r in rows]
    return sum(values)/len(values) if values and all(v is not None for v in values) else None

def percentiles(values):
    """0..100 average rank, ties equal; singleton = 50."""
    ordered = sorted(values.items(), key=lambda item: item[1])
    result = {}
    i = 0
    while i < len(ordered):
        j = i + 1
        while j < len(ordered) and ordered[j][1] == ordered[i][1]:
            j += 1
        score = 50 if len(ordered) == 1 else 100*(i+j-1)/2/(len(ordered)-1)
        for code, _ in ordered[i:j]:
            result[code] = score
        i = j
    return result

def rank_hotstocks(stocks, companies, latest):
    calendar = sorted({h['date'] for s in stocks for h in s['history'] if h['date'] <= latest})
    dates = calendar[-25:]
    result = {}
    for stock in stocks:
        code = stock['code']
        if code not in companies:
            continue
        history = {h['date']: h for h in stock['history']}
        if latest not in history:
            continue
        bar = history[latest]
        shares = numeric(companies[code].get('已發行普通股數或TDR原股發行股數'))
        volume = numeric(bar.get('volume'))
        record = {'code': code, 'amount': numeric(bar.get('turnover')), 'relativeVolume': None,
                  'turnoverRate': volume/shares*100 if shares and volume is not None else None,
                  'amountAcceleration': None, 'issuedShares': shares,
                  'sharesAsOf': companies[code].get('出表日期'), 'score': None, 'rank': None}
        if len(dates) == 25 and all(d in history for d in dates):
            rows = [history[d] for d in dates]
            base_volume = average(rows[-21:-1], 'volume')
            if base_volume and volume is not None:
                record['relativeVolume'] = volume/base_volume
            base_amount = average(rows[:20], 'turnover')
            recent_amount = average(rows[-5:], 'turnover')
            if base_amount and recent_amount is not None:
                record['amountAcceleration'] = (recent_amount/base_amount-1)*100
        record['missing'] = [field for field in WEIGHTS if record[field] is None]
        result[code] = record
    eligible = {code: r for code, r in result.items() if not r['missing'] and r['amount'] > 0}
    for field, weight in WEIGHTS.items():
        ranks = percentiles({code: r[field] for code, r in eligible.items()})
        for code, percentile in ranks.items():
            record = eligible[code]
            record['score'] = (record['score'] or 0) + percentile*weight
            record.setdefault('percentiles', {})[field] = percentile
    ordered = sorted(eligible.values(), key=lambda r: (-r['score'], -r['amount'], r['code']))
    prior = None
    rank = 0
    for position, record in enumerate(ordered, 1):
        if prior is None or abs(record['score']-prior) > 1e-10:
            rank = position
        record['rank'] = rank
        prior = record['score']
        record['score'] = round(record['score'], 2)
    return result

def rank_groups(groups, records):
    amounts = percentiles({g['name']: g['turnover'] for g in groups})
    for group in groups:
        eligible = sorted((records[c] for c in group['codes'] if c in records and records[c]['score'] is not None), key=lambda r: -r['score'])
        group['rankedCount'] = len(eligible)
        group['leadingMean'] = sum(r['score'] for r in eligible[:5])/min(5, len(eligible)) if eligible else None
        group['heatScore'] = round(.5*amounts[group['name']] + .5*group['leadingMean'], 2) if eligible else None
    return sorted(groups, key=lambda g: (g['heatScore'] is None, -(g['heatScore'] or 0), -g['turnover']))
