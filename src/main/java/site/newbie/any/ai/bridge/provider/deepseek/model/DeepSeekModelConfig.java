package site.newbie.any.ai.bridge.provider.deepseek.model;

import com.microsoft.playwright.Page;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import site.newbie.any.ai.bridge.model.ChatCompletionRequest;
import site.newbie.any.ai.bridge.provider.ModelConfig;

/**
 * DeepSeek 模型配置接口
 * 继承通用 ModelConfig，定义 DeepSeek 特定的上下文类型
 */
public interface DeepSeekModelConfig extends ModelConfig<DeepSeekModelConfig.DeepSeekContext> {
    
    /**
     * DeepSeek 监听上下文
     */
    record DeepSeekContext(
            Page page,
            SseEmitter emitter,
            ChatCompletionRequest request,
            int messageCountBefore,
            ModelConfig.ResponseHandler responseHandler
    ) {}
}
