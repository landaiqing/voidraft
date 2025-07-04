package services

import (
	"sync"
	"time"
	"voidraft/internal/common/translator"

	"github.com/wailsapp/wails/v3/pkg/services/log"
	"golang.org/x/text/language"
)

// TranslationService 翻译服务
type TranslationService struct {
	logger           *log.LoggerService
	factory          *translator.TranslatorFactory
	defaultTimeout   time.Duration
	activeTranslator translator.TranslatorType
	translators      map[translator.TranslatorType]translator.Translator
	mutex            sync.RWMutex
}

// NewTranslationService 创建翻译服务实例
func NewTranslationService(logger *log.LoggerService) *TranslationService {
	factory := translator.NewTranslatorFactory()
	defaultTimeout := 10 * time.Second

	// 默认使用bin翻译
	activeType := translator.BingTranslatorType

	// 预初始化所有翻译器
	translators := make(map[translator.TranslatorType]translator.Translator)

	service := &TranslationService{
		logger:           logger,
		factory:          factory,
		defaultTimeout:   defaultTimeout,
		activeTranslator: activeType,
		translators:      translators,
	}

	// 延迟初始化翻译器以提高启动速度
	go service.initTranslators()

	return service
}

// initTranslators 初始化所有翻译器
func (s *TranslationService) initTranslators() {
	types := []translator.TranslatorType{
		translator.GoogleTranslatorType,
		translator.BingTranslatorType,
		translator.YoudaoTranslatorType,
		translator.DeeplTranslatorType,
	}

	for _, t := range types {
		trans, err := s.factory.Create(t)
		if err != nil {
			s.logger.Error("Failed to create translator: %v", err)
			continue
		}

		trans.SetTimeout(s.defaultTimeout)

		s.mutex.Lock()
		s.translators[t] = trans
		s.mutex.Unlock()
	}
}

// getTranslator 获取指定类型的翻译器
func (s *TranslationService) getTranslator(translatorType translator.TranslatorType) (translator.Translator, error) {
	s.mutex.RLock()
	trans, exists := s.translators[translatorType]
	s.mutex.RUnlock()

	if exists {
		return trans, nil
	}

	// 如果翻译器尚未初始化，则立即创建
	trans, err := s.factory.Create(translatorType)
	if err != nil {
		return nil, err
	}

	trans.SetTimeout(s.defaultTimeout)

	s.mutex.Lock()
	s.translators[translatorType] = trans
	s.mutex.Unlock()

	return trans, nil
}

// Translate 使用当前活跃翻译器进行翻译
// @param {string} text - 待翻译文本
// @param {string} from - 源语言代码 (如 "en", "zh", "auto")
// @param {string} to - 目标语言代码 (如 "en", "zh")
// @returns {string} 翻译后的文本
// @returns {error} 可能的错误
func (s *TranslationService) Translate(text string, from string, to string) (string, error) {
	// 解析语言标签
	var fromLang, toLang language.Tag
	var err error

	if from == "auto" {
		fromLang = language.Und // 未定义，表示自动检测
	} else {
		fromLang, err = language.Parse(from)
		if err != nil {
			return "", err
		}
	}

	toLang, err = language.Parse(to)
	if err != nil {
		return "", err
	}

	// 获取活跃翻译器
	s.mutex.RLock()
	activeType := s.activeTranslator
	s.mutex.RUnlock()

	trans, err := s.getTranslator(activeType)
	if err != nil {
		return "", err
	}

	// 执行翻译
	return trans.Translate(text, fromLang, toLang)
}

// TranslateWithFallback 尝试使用当前活跃翻译器翻译，如果失败则尝试备用翻译器
// @param {string} text - 待翻译文本
// @param {string} from - 源语言代码 (如 "en", "zh", "auto")
// @param {string} to - 目标语言代码 (如 "en", "zh")
// @returns {string} 翻译后的文本
// @returns {string} 使用的翻译器类型
// @returns {error} 可能的错误
func (s *TranslationService) TranslateWithFallback(text string, from string, to string) (string, string, error) {
	// 首先尝试活跃翻译器
	s.mutex.RLock()
	primaryType := s.activeTranslator
	s.mutex.RUnlock()

	result, err := s.TranslateWith(text, from, to, string(primaryType))
	if err == nil {
		return result, string(primaryType), nil
	}

	// 备用翻译器列表
	fallbacks := []translator.TranslatorType{
		translator.GoogleTranslatorType,
		translator.BingTranslatorType,
		translator.DeeplTranslatorType,
		translator.YoudaoTranslatorType,
	}

	// 尝试备用翻译器
	for _, fallbackType := range fallbacks {
		if fallbackType == primaryType {
			continue // 跳过已尝试的主要翻译器
		}

		result, err := s.TranslateWith(text, from, to, string(fallbackType))
		if err == nil {
			return result, string(fallbackType), nil
		}
	}

	return "", "", err // 所有翻译器都失败时返回最后一个错误
}

// TranslateWith 使用指定翻译器进行翻译
// @param {string} text - 待翻译文本
// @param {string} from - 源语言代码 (如 "en", "zh", "auto")
// @param {string} to - 目标语言代码 (如 "en", "zh")
// @param {string} translatorType - 翻译器类型 ("google", "bing", "youdao", "deepl")
// @returns {string} 翻译后的文本
// @returns {error} 可能的错误
func (s *TranslationService) TranslateWith(text string, from string, to string, translatorType string) (string, error) {
	// 参数验证
	if text == "" {
		return "", nil // 空文本无需翻译
	}

	// 转换为翻译器类型
	transType := translator.TranslatorType(translatorType)

	// 获取指定翻译器
	trans, err := s.getTranslator(transType)
	if err != nil {
		return "", err
	}

	// 创建翻译参数
	params := translator.TranslationParams{
		From:  from,
		To:    to,
		Tries: 2,
		Delay: 500 * time.Millisecond,
	}

	// 执行翻译
	return trans.TranslateWithParams(text, params)
}

// SetActiveTranslator 设置活跃翻译器
// @param {string} translatorType - 翻译器类型 ("google", "bing", "youdao", "deepl")
// @returns {error} 可能的错误
func (s *TranslationService) SetActiveTranslator(translatorType string) error {
	transType := translator.TranslatorType(translatorType)

	// 验证翻译器类型
	_, err := s.factory.Create(transType)
	if err != nil {
		return err
	}

	s.mutex.Lock()
	s.activeTranslator = transType
	s.mutex.Unlock()

	return nil
}

// GetAvailableTranslators 获取所有可用翻译器类型
// @returns {[]string} 翻译器类型列表
func (s *TranslationService) GetAvailableTranslators() []string {
	return []string{
		string(translator.GoogleTranslatorType),
		string(translator.BingTranslatorType),
		string(translator.YoudaoTranslatorType),
		string(translator.DeeplTranslatorType),
	}
}

// SetTimeout 设置翻译超时时间
// @param {int} seconds - 超时秒数
func (s *TranslationService) SetTimeout(seconds int) {
	timeout := time.Duration(seconds) * time.Second

	s.mutex.Lock()
	s.defaultTimeout = timeout
	s.mutex.Unlock()

	// 更新所有现有翻译器的超时设置
	for _, t := range s.translators {
		t.SetTimeout(timeout)
	}
}
