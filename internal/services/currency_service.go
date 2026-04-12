package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

const (
	currencyRatesURL    = "https://currencies.heynote.com/rates.json"
	currencyStaleTime   = 12 * time.Hour
	currencyHTTPTimeout = 15 * time.Second
)

type CurrencyData struct {
	Base      string             `json:"base"`
	Rates     map[string]float64 `json:"rates"`
	Timestamp int64              `json:"timestamp,omitempty"`
}

type currencyCache struct {
	Data        *CurrencyData `json:"data,omitempty"`
	TimeFetched int64         `json:"timeFetched,omitempty"`
}

type CurrencyService struct {
	configService *ConfigService
	logger        *log.LogService
	client        *http.Client
	now           func() time.Time
}

func NewCurrencyService(configService *ConfigService, logger *log.LogService) *CurrencyService {
	if logger == nil {
		logger = log.New()
	}

	return &CurrencyService{
		configService: configService,
		logger:        logger,
		client: &http.Client{
			Timeout: currencyHTTPTimeout,
		},
		now: time.Now,
	}
}

func (s *CurrencyService) GetCurrencyData(ctx context.Context) (*CurrencyData, error) {
	cached, cacheErr := s.readCachedCurrency()
	if cacheErr != nil {
		s.logger.Error("failed to read cached currency data", "error", cacheErr)
	}

	if cached != nil && cached.Data != nil && cached.TimeFetched > 0 {
		fetchedAt := time.UnixMilli(cached.TimeFetched)
		if s.now().Sub(fetchedAt) < currencyStaleTime {
			return cached.Data, nil
		}
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, currencyRatesURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Cache-Control", "no-cache")

	response, err := s.client.Do(request)
	if err != nil {
		if cached != nil && cached.Data != nil {
			s.logger.Error("fetch currency data failed, using cached data", "error", err)
			return cached.Data, nil
		}
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		if cached != nil && cached.Data != nil {
			s.logger.Error("currency service returned non-success status, using cached data", "status", response.Status)
			return cached.Data, nil
		}
		return nil, fmt.Errorf("currency service returned status %s", response.Status)
	}

	var data CurrencyData
	if err := json.NewDecoder(response.Body).Decode(&data); err != nil {
		if cached != nil && cached.Data != nil {
			s.logger.Error("decode currency data failed, using cached data", "error", err)
			return cached.Data, nil
		}
		return nil, err
	}

	if data.Base == "" || len(data.Rates) == 0 {
		if cached != nil && cached.Data != nil {
			s.logger.Error("currency data invalid, using cached data")
			return cached.Data, nil
		}
		return nil, fmt.Errorf("currency data is invalid")
	}

	if s.configService != nil {
		cache := currencyCache{
			Data:        &data,
			TimeFetched: s.now().UnixMilli(),
		}
		if err := s.configService.Set("currency", cache); err != nil {
			s.logger.Error("failed to persist currency cache", "error", err)
		}
	}

	return &data, nil
}

func (s *CurrencyService) readCachedCurrency() (*currencyCache, error) {
	if s.configService == nil {
		return nil, nil
	}

	rawValue := s.configService.Get("currency")
	if rawValue == nil {
		return nil, nil
	}

	payload, err := json.Marshal(rawValue)
	if err != nil {
		return nil, err
	}

	var cache currencyCache
	if err := json.Unmarshal(payload, &cache); err != nil {
		return nil, err
	}

	if cache.Data == nil || cache.Data.Base == "" || len(cache.Data.Rates) == 0 {
		return nil, nil
	}

	return &cache, nil
}
