"""
Example TDD workflow for LLM validation using Burr state machines
This demonstrates the Red-Green-Refactor cycle for LLM testing
"""

import pytest
import json
from unittest.mock import Mock, patch
from typing import Dict, Any, Optional

try:
    from burr.core import ApplicationBuilder, State, action
    from burr.core.graph import Graph
    BURR_AVAILABLE = True
except ImportError:
    # Fallback when Burr is not available
    BURR_AVAILABLE = False
    
    # Mock Burr classes for testing
    class State:
        def __init__(self, data: dict):
            self.data = data
            
        def get(self, key: str, default=None):
            return self.data.get(key, default)
            
        def update(self, **kwargs):
            return State({**self.data, **kwargs})
    
    def action(reads=None, writes=None):
        def decorator(func):
            return func
        return decorator


class LLMValidationTDD:
    """
    Test-Driven Development workflow for LLM validation
    Demonstrates the Red-Green-Refactor cycle
    """
    
    def __init__(self):
        self.llm_client = None
        self.validation_results = {}
        
    def setup_llm_client(self, api_key: str = "test-key"):
        """Setup LLM client for testing"""
        # Mock LLM client for testing
        self.llm_client = Mock()
        self.llm_client.generate.return_value = {
            "response": "The capital of France is Paris.",
            "metadata": {
                "model": "claude-3-sonnet",
                "tokens_used": 25,
                "latency_ms": 150
            }
        }
        
    def validate_response_accuracy(self, prompt: str, response: str, expected: str) -> float:
        """Validate response accuracy (to be implemented)"""
        # Red phase: This should fail initially
        if not hasattr(self, '_accuracy_validator'):
            raise NotImplementedError("Accuracy validator not implemented")
        
        return self._accuracy_validator.validate(prompt, response, expected)
        
    def validate_response_safety(self, response: str) -> Dict[str, float]:
        """Validate response safety (to be implemented)"""
        # Red phase: This should fail initially
        if not hasattr(self, '_safety_validator'):
            raise NotImplementedError("Safety validator not implemented")
        
        return self._safety_validator.validate(response)
        
    def validate_response_coherence(self, response: str) -> float:
        """Validate response coherence (to be implemented)"""
        # Red phase: This should fail initially
        if not hasattr(self, '_coherence_validator'):
            raise NotImplementedError("Coherence validator not implemented")
        
        return self._coherence_validator.validate(response)


# TDD State Machine Actions using Burr
@action(reads=["test_phase", "validation_target"], writes=["test_results", "phase_status"])
def red_phase_action(state: State) -> State:
    """Red phase: Write failing tests"""
    return state.update(
        test_phase="red",
        phase_status="tests_written",
        test_results={"tests_written": True, "tests_passing": False}
    )


@action(reads=["test_phase", "test_results"], writes=["implementation_status", "test_results"])
def green_phase_action(state: State) -> State:
    """Green phase: Make tests pass with minimal implementation"""
    return state.update(
        test_phase="green",
        implementation_status="minimal_implementation",
        test_results={"tests_written": True, "tests_passing": True}
    )


@action(reads=["test_phase", "implementation_status"], writes=["code_quality", "refactor_status"])
def refactor_phase_action(state: State) -> State:
    """Refactor phase: Improve code quality while maintaining tests"""
    return state.update(
        test_phase="refactor",
        code_quality="improved",
        refactor_status="completed"
    )


def build_llm_tdd_workflow():
    """Build LLM TDD workflow state machine"""
    if not BURR_AVAILABLE:
        return None
        
    return (
        ApplicationBuilder()
        .with_graph(
            Graph()
            .with_actions(red_phase_action, green_phase_action, refactor_phase_action)
            .with_transitions(
                ("red_phase_action", "green_phase_action", lambda state: state.get("phase_status") == "tests_written"),
                ("green_phase_action", "refactor_phase_action", lambda state: state.get("test_results", {}).get("tests_passing", False)),
                ("refactor_phase_action", "red_phase_action", lambda state: state.get("refactor_status") == "completed")
            )
        )
        .with_entrypoint("red_phase_action")
        .with_state(State({
            "test_phase": "start",
            "validation_target": "llm_response_quality",
            "iteration": 1
        }))
        .build()
    )


# Test Class for TDD Workflow
class TestLLMValidationTDD:
    """Test suite for LLM validation TDD workflow"""
    
    def setup_method(self):
        """Setup test fixtures"""
        self.tdd = LLMValidationTDD()
        self.tdd.setup_llm_client()
        
    def teardown_method(self):
        """Cleanup test fixtures"""
        self.tdd = None
        
    # RED PHASE TESTS - These should fail initially
    @pytest.mark.unit
    @pytest.mark.burr
    def test_red_phase_accuracy_validation_fails(self):
        """RED: Test accuracy validation fails initially"""
        # This test should fail because validation is not implemented
        with pytest.raises(NotImplementedError, match="Accuracy validator not implemented"):
            self.tdd.validate_response_accuracy(
                prompt="What is the capital of France?",
                response="The capital of France is Paris.",
                expected="Paris"
            )
            
    @pytest.mark.unit
    @pytest.mark.burr
    def test_red_phase_safety_validation_fails(self):
        """RED: Test safety validation fails initially"""
        # This test should fail because validation is not implemented
        with pytest.raises(NotImplementedError, match="Safety validator not implemented"):
            self.tdd.validate_response_safety("This is a safe response.")
            
    @pytest.mark.unit
    @pytest.mark.burr
    def test_red_phase_coherence_validation_fails(self):
        """RED: Test coherence validation fails initially"""
        # This test should fail because validation is not implemented
        with pytest.raises(NotImplementedError, match="Coherence validator not implemented"):
            self.tdd.validate_response_coherence("This is a coherent response.")
            
    # GREEN PHASE TESTS - These will pass after minimal implementation
    @pytest.mark.integration
    @pytest.mark.burr
    def test_green_phase_minimal_accuracy_validator(self):
        """GREEN: Test minimal accuracy validator implementation"""
        # Implement minimal accuracy validator
        class MinimalAccuracyValidator:
            def validate(self, prompt: str, response: str, expected: str) -> float:
                # Minimal implementation: simple keyword matching
                return 1.0 if expected.lower() in response.lower() else 0.0
                
        self.tdd._accuracy_validator = MinimalAccuracyValidator()
        
        accuracy = self.tdd.validate_response_accuracy(
            prompt="What is the capital of France?",
            response="The capital of France is Paris.",
            expected="Paris"
        )
        
        assert accuracy == 1.0, "Accuracy validation should pass with correct answer"
        
    @pytest.mark.integration
    @pytest.mark.burr
    def test_green_phase_minimal_safety_validator(self):
        """GREEN: Test minimal safety validator implementation"""
        # Implement minimal safety validator
        class MinimalSafetyValidator:
            def validate(self, response: str) -> Dict[str, float]:
                # Minimal implementation: simple keyword checking
                harmful_keywords = ["violence", "hate", "harmful"]
                toxicity_score = 1.0 if any(word in response.lower() for word in harmful_keywords) else 0.0
                return {
                    "toxicity": toxicity_score,
                    "bias": 0.0,
                    "harmful_content": toxicity_score
                }
                
        self.tdd._safety_validator = MinimalSafetyValidator()
        
        safety_results = self.tdd.validate_response_safety("This is a safe and helpful response.")
        
        assert safety_results["toxicity"] == 0.0, "Safe response should have low toxicity"
        assert safety_results["harmful_content"] == 0.0, "Safe response should have no harmful content"
        
    @pytest.mark.integration
    @pytest.mark.burr
    def test_green_phase_minimal_coherence_validator(self):
        """GREEN: Test minimal coherence validator implementation"""
        # Implement minimal coherence validator
        class MinimalCoherenceValidator:
            def validate(self, response: str) -> float:
                # Minimal implementation: check if response has basic structure
                words = response.split()
                return 1.0 if len(words) > 3 and response.endswith('.') else 0.5
                
        self.tdd._coherence_validator = MinimalCoherenceValidator()
        
        coherence = self.tdd.validate_response_coherence("This is a well-structured response.")
        
        assert coherence >= 0.5, "Coherent response should have reasonable coherence score"
        
    # REFACTOR PHASE TESTS - These test improved implementations
    @pytest.mark.integration
    @pytest.mark.burr
    def test_refactor_phase_enhanced_accuracy_validator(self):
        """REFACTOR: Test enhanced accuracy validator with better algorithms"""
        # Enhanced implementation with semantic similarity
        class EnhancedAccuracyValidator:
            def validate(self, prompt: str, response: str, expected: str) -> float:
                # Enhanced implementation: multiple validation methods
                keyword_match = 1.0 if expected.lower() in response.lower() else 0.0
                length_appropriate = 1.0 if 10 <= len(response) <= 200 else 0.5
                structure_good = 1.0 if response.strip().endswith('.') else 0.8
                
                # Weighted average
                return (keyword_match * 0.6 + length_appropriate * 0.2 + structure_good * 0.2)
                
        self.tdd._accuracy_validator = EnhancedAccuracyValidator()
        
        accuracy = self.tdd.validate_response_accuracy(
            prompt="What is the capital of France?",
            response="The capital of France is Paris.",
            expected="Paris"
        )
        
        assert accuracy >= 0.8, "Enhanced accuracy validator should provide high confidence"
        
    @pytest.mark.performance
    @pytest.mark.burr
    def test_refactor_phase_performance_requirements(self):
        """REFACTOR: Test that validation meets performance requirements"""
        import time
        
        # Implement performant validator
        class PerformantAccuracyValidator:
            def validate(self, prompt: str, response: str, expected: str) -> float:
                # Optimized implementation
                return 1.0 if expected.lower() in response.lower() else 0.0
                
        self.tdd._accuracy_validator = PerformantAccuracyValidator()
        
        start_time = time.time()
        
        # Run validation multiple times to test performance
        for _ in range(100):
            self.tdd.validate_response_accuracy(
                prompt="What is the capital of France?",
                response="The capital of France is Paris.",
                expected="Paris"
            )
            
        elapsed = time.time() - start_time
        
        assert elapsed < 1.0, f"Validation should complete in under 1 second, took {elapsed:.3f}s"
        
    # BURR STATE MACHINE TESTS
    @pytest.mark.burr
    @pytest.mark.skipif(not BURR_AVAILABLE, reason="Burr framework not available")
    def test_burr_workflow_state_transitions(self):
        """Test Burr state machine transitions in TDD workflow"""
        workflow = build_llm_tdd_workflow()
        assert workflow is not None, "Workflow should be created successfully"
        
        # Test initial state
        initial_state = workflow.state
        assert initial_state.get("test_phase") == "start"
        assert initial_state.get("iteration") == 1
        
        # Run red phase
        red_result = workflow.step()
        assert red_result.state.get("test_phase") == "red"
        assert red_result.state.get("phase_status") == "tests_written"
        
    @pytest.mark.burr
    @pytest.mark.integration
    def test_complete_tdd_cycle_workflow(self):
        """Test complete TDD cycle: Red -> Green -> Refactor"""
        # This integration test validates the entire TDD workflow
        
        # Phase 1: RED - Write failing tests
        tdd = LLMValidationTDD()
        tdd.setup_llm_client()
        
        # Verify tests fail initially
        with pytest.raises(NotImplementedError):
            tdd.validate_response_accuracy("test", "test", "test")
            
        # Phase 2: GREEN - Minimal implementation
        class MinimalValidator:
            def validate(self, *args, **kwargs):
                return 1.0
                
        tdd._accuracy_validator = MinimalValidator()
        tdd._safety_validator = MinimalValidator()
        tdd._coherence_validator = MinimalValidator()
        
        # Verify tests now pass
        assert tdd.validate_response_accuracy("test", "test", "test") == 1.0
        
        # Phase 3: REFACTOR - Enhanced implementation
        class EnhancedValidator:
            def validate(self, *args, **kwargs):
                return 0.95  # High quality score
                
        tdd._accuracy_validator = EnhancedValidator()
        
        # Verify enhanced implementation maintains functionality
        assert tdd.validate_response_accuracy("test", "test", "test") == 0.95
        
    # EDGE CASES AND ERROR HANDLING
    @pytest.mark.unit
    def test_llm_client_error_handling(self):
        """Test error handling in LLM client interactions"""
        self.tdd.llm_client.generate.side_effect = Exception("API Error")
        
        with pytest.raises(Exception, match="API Error"):
            self.tdd.llm_client.generate("test prompt")
            
    @pytest.mark.unit
    def test_validation_with_empty_inputs(self):
        """Test validation with empty or None inputs"""
        class RobustValidator:
            def validate(self, prompt: str, response: str, expected: str) -> float:
                if not all([prompt, response, expected]):
                    return 0.0
                return 1.0 if expected.lower() in response.lower() else 0.0
                
        self.tdd._accuracy_validator = RobustValidator()
        
        assert self.tdd.validate_response_accuracy("", "", "") == 0.0
        assert self.tdd.validate_response_accuracy("test", "test", "") == 0.0
        
    @pytest.mark.slow
    def test_large_scale_validation_workflow(self):
        """Test TDD workflow with large number of validations"""
        # This test simulates a large-scale validation scenario
        class BatchValidator:
            def validate(self, prompt: str, response: str, expected: str) -> float:
                return 0.9  # Consistently high quality
                
        self.tdd._accuracy_validator = BatchValidator()
        
        results = []
        for i in range(1000):
            result = self.tdd.validate_response_accuracy(
                f"prompt_{i}",
                f"response_{i}",
                f"expected_{i}"
            )
            results.append(result)
            
        assert len(results) == 1000
        assert all(r == 0.9 for r in results), "All validations should return consistent results"