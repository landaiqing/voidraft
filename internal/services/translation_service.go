package services

import (
	"sync"
	"time"
	"voidraft/internal/common/translator"

	"github.com/wailsapp/wails/v3/pkg/services/log"
)

// TranslationService 翻译服务
type TranslationService struct {
	logger         *log.LogService
	factory        *translator.TranslatorFactory
	defaultTimeout time.Duration
	translators    map[translator.TranslatorType]translator.Translator
	mutex          sync.RWMutex
}

// NewTranslationService 创建翻译服务实例
func NewTranslationService(logger *log.LogService) *TranslationService {
	service := &TranslationService{
		logger:         logger,
		factory:        translator.NewTranslatorFactory(),
		defaultTimeout: 10 * time.Second,
		translators:    make(map[translator.TranslatorType]translator.Translator),
	}
	return service
}

// getTranslator 获取指定类型的翻译器，如不存在则创建
func (s *TranslationService) getTranslator(translatorType translator.TranslatorType) (translator.Translator, error) {
	s.mutex.RLock()
	trans, exists := s.translators[translatorType]
	s.mutex.RUnlock()

	if exists {
		return trans, nil
	}

	// 创建新的翻译器实例
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

// TranslateWith 使用指定翻译器进行翻译
// @param {string} text - 待翻译文本
// @param {string} from - 源语言代码 (如 "en", "zh", "auto")
// @param {string} to - 目标语言代码 (如 "en", "zh")
// @param {string} translatorType - 翻译器类型 ("google", "bing", "youdao", "deepl")
// @returns {string} 翻译后的文本
// @returns {error} 可能的错误
func (s *TranslationService) TranslateWith(text string, from string, to string, translatorType string) (string, error) {
	// 空文本直接返回
	if text == "" {
		return "", nil
	}
	if translatorType == "" {
		translatorType = string(translator.BingTranslatorType)
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
		From:    from,
		To:      to,
		Timeout: s.defaultTimeout,
	}

	// 执行翻译
	return trans.TranslateWithParams(text, params)
}

// GetTranslators 获取所有可用翻译器类型
// @returns {[]string} 翻译器类型列表
func (s *TranslationService) GetTranslators() []string {
	return []string{
		string(translator.BingTranslatorType),
		string(translator.GoogleTranslatorType),
		string(translator.YoudaoTranslatorType),
		string(translator.DeeplTranslatorType),
		string(translator.TartuNLPTranslatorType),
	}
}

// GetTranslatorLanguages 获取翻译器的语言列表
// @param {string} translatorType - 翻译器类型 ("google", "bing", "youdao", "deepl")
// @returns {map[string]string} 语言代码到名称的映射
// @returns {error} 可能的错误
func (s *TranslationService) GetTranslatorLanguages(translatorType translator.TranslatorType) (map[string]translator.LanguageInfo, error) {
	translator, err := s.getTranslator(translatorType)
	if err != nil {
		return nil, err
	}
	// 获取语言列表
	languages := translator.GetSupportedLanguages()
	return languages, nil
}

// IsLanguageSupported 检查指定的语言代码是否受支持
func (s *TranslationService) IsLanguageSupported(translatorType translator.TranslatorType, languageCode string) bool {
	translator, err := s.getTranslator(translatorType)
	if err != nil {
		return false
	}
	return translator.IsLanguageSupported(languageCode)
}
